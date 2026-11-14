import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';

const challengeScript=`window.turnstile={render(container,options){
  const button=document.createElement('button');button.type='button';button.textContent='Resolver desafío de prueba';
  button.onclick=()=>options.callback('synthetic-challenge-'+(++window.challengeCount));container.append(button);
  window.lastChallenge=options;return button;
},remove(button){button.remove();}};window.challengeCount=0;`;

test('account email forms preserve safety gates, fresh challenges and accessible feedback',{timeout:60000},async t=>{
  const server=await createServer({server:{host:'127.0.0.1',port:5208,strictPort:false}});
  let browser;
  try{
    await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
    browser=await chromium.launch({executablePath:process.env.DW_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,timeout:15000,
      args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const fixture=async({enabled=true,failFirst=false}={})=>{
      const page=await browser.newPage(),requests=[];page.setDefaultTimeout(10000);
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.href==='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')return route.fulfill({contentType:'application/javascript',body:challengeScript});
        if(url.origin!==base)return route.abort();
        if(url.pathname==='/api/auth/config')return route.fulfill({json:{registrationEnabled:enabled,turnstileSiteKey:enabled?'synthetic-sitekey':null}});
        if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:null}});
        if(['/api/auth/resend','/api/auth/forgot'].includes(url.pathname)){
          requests.push({path:url.pathname,...route.request().postDataJSON()});
          return failFirst&&requests.length===1?route.fulfill({status:503,json:{error:'No pudimos procesar el envío de prueba.'}})
            :route.fulfill({json:{message:'Si corresponde, recibirás un enlace por correo.'}});
        }
        if(url.pathname==='/api/auth/login')return route.fulfill({status:401,json:{error:'Credenciales inválidas o correo sin verificar.'}});
        if(url.pathname.startsWith('/api/'))return route.fulfill({json:{tracks:[],volumes:[]}});
        return route.continue();
      });
      await page.goto(base);
      const open=async name=>{
        await page.locator('.header-actions').getByRole('button',{name:'Ingresar',exact:true}).click();
        if(name!=='Ingresar')await page.getByRole('button',{name,exact:true}).click();
        return page.getByRole('dialog');
      };
      return {page,requests,open};
    };
    await t.test('resend remains disabled while accounts are closed',async()=>{
      const f=await fixture({enabled:false});
      try{
        const dialog=await f.open('Reenviar verificación');
        await dialog.getByLabel('Correo',{exact:true}).fill('artist@example.test');
        assert.equal(await dialog.getByRole('button',{name:'Reenviar enlace',exact:true}).isDisabled(),true);
        assert.equal(await dialog.getByRole('button',{name:'Resolver desafío de prueba'}).count(),0);
        assert.deepEqual(f.requests,[]);
      }finally{await f.page.close();}
    });
    await t.test('resend uses a fresh challenge and retains generic feedback and email after each attempt',async()=>{
      const f=await fixture({failFirst:true});
      try{
        const dialog=await f.open('Reenviar verificación'),send=dialog.getByRole('button',{name:'Reenviar enlace',exact:true});
        await dialog.getByLabel('Correo',{exact:true}).fill('artist@example.test');
        assert.equal(await send.isDisabled(),true);
        await dialog.getByRole('button',{name:'Resolver desafío de prueba'}).click();await send.click();
        await dialog.getByRole('status').filter({hasText:'No pudimos procesar'}).waitFor();
        assert.equal(await send.isDisabled(),true);
        assert.equal(await dialog.getByLabel('Correo',{exact:true}).inputValue(),'artist@example.test');
        await dialog.getByRole('button',{name:'Resolver desafío de prueba'}).click();await send.click();
        await dialog.getByRole('status').filter({hasText:'Si corresponde'}).waitFor();
        assert.equal(await send.isDisabled(),true);
        assert.deepEqual(f.requests.map(request=>request.path),['/api/auth/resend','/api/auth/resend']);
        assert.notEqual(f.requests[0].turnstileToken,f.requests[1].turnstileToken);
      }finally{await f.page.close();}
    });
    await t.test('expired challenges and dialog changes cannot reuse a previous challenge',async()=>{
      const f=await fixture();
      try{
        let dialog=await f.open('Reenviar verificación');
        await dialog.getByRole('button',{name:'Resolver desafío de prueba'}).click();
        await f.page.evaluate(()=>window.lastChallenge['expired-callback']());
        assert.equal(await dialog.getByRole('button',{name:'Reenviar enlace',exact:true}).isDisabled(),true);
        await dialog.getByRole('button',{name:'Resolver desafío de prueba'}).click();
        await f.page.keyboard.press('Escape');dialog=await f.open('Olvidé mi contraseña');
        assert.equal(await dialog.getByRole('button',{name:'Enviar enlace',exact:true}).isDisabled(),true);
        await dialog.getByLabel('Correo',{exact:true}).fill('artist@example.test');
        await dialog.getByRole('button',{name:'Resolver desafío de prueba'}).click();
        await dialog.getByRole('button',{name:'Enviar enlace',exact:true}).click();
        await dialog.getByRole('status').filter({hasText:'Si corresponde'}).waitFor();
        assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/auth/forgot');
      }finally{await f.page.close();}
    });
    for(const operation of ['refresh','mutation','forbidden'])await t.test(`administrative ${operation} clears stale private data on lost access`,async()=>{
      const f=await fixture();let denied=false;
      try{
        await f.page.route('**/api/auth/me',route=>route.fulfill({json:{user:{id:'admin-test',role:'admin',displayName:'Test Admin'}}}));
        await f.page.route('**/api/admin/**',route=>{
          const path=new URL(route.request().url()).pathname;
          if(denied||path.endsWith('publication'))return route.fulfill({status:operation==='forbidden'?403:401,json:{error:'Synthetic access loss'}});
          return route.fulfill({json:path.endsWith('history')?{events:[]}:{tracks:[{id:'synthetic-track',title:'Synthetic private track',artist:'Test artist',genre:'Dubstep',status:'approved',scanStatus:'clean'}]}});
        });
        await f.page.reload();await f.page.getByRole('button',{name:'Administración',exact:true}).click();
        await f.page.getByText('Synthetic private track — Test artist',{exact:true}).waitFor();
        if(operation==='mutation'){
          f.page.once('dialog',dialog=>dialog.accept());
          await f.page.getByRole('button',{name:'Publicar',exact:true}).click();
        }else{denied=true;await f.page.getByRole('button',{name:'Actualizar listado',exact:true}).click();}
        if(operation==='forbidden'){
          await f.page.getByRole('status').filter({hasText:'Tus permisos cambiaron'}).waitFor();
          assert.equal(await f.page.getByRole('dialog').count(),0);
          assert.equal(await f.page.getByRole('button',{name:'Test Admin · Salir',exact:true}).count(),1);
        }else{
          await f.page.getByRole('dialog',{name:'Ingresar',exact:true}).waitFor();
          assert.equal(await f.page.getByRole('button',{name:'Administración',exact:true}).count(),0);
        }
        assert.equal(await f.page.getByText('Synthetic private track — Test artist',{exact:true}).count(),0);
      }finally{await f.page.close();}
    });
    await t.test('an expired upload session returns to login and the upload dialog supports keyboard navigation',async()=>{
      const f=await fixture();
      try{
        await f.page.route('**/api/auth/me',route=>route.fulfill({json:{user:{id:'artist-test',role:'artist',displayName:'Test Artist'}}}));
        await f.page.route('**/api/tracks/submit',route=>route.fulfill({status:401,json:{error:'Synthetic expired session'}}));
        await f.page.reload();await f.page.getByRole('button',{name:'Test Artist · Salir',exact:true}).waitFor();
        const trigger=f.page.getByRole('button',{name:/Subí tu track/});await trigger.click();
        let dialog=f.page.getByRole('dialog',{name:'Subí tu track',exact:true});
        await f.page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Cerrar ventana');
        await f.page.keyboard.press('Shift+Tab');
        assert.equal(await dialog.getByRole('button',{name:'Enviar a revisión',exact:true}).evaluate(element=>element===document.activeElement),true);
        await f.page.keyboard.press('Tab');await f.page.keyboard.press('Escape');
        assert.equal(await trigger.evaluate(element=>element===document.activeElement),true);
        await trigger.click();dialog=f.page.getByRole('dialog',{name:'Subí tu track',exact:true});
        await dialog.getByLabel('Título',{exact:true}).fill('Synthetic upload');
        await dialog.getByLabel('Nombre artístico',{exact:true}).fill('Test Artist');
        await dialog.getByLabel('MP3 (máximo 10 MB)',{exact:true}).setInputFiles({name:'test.mp3',mimeType:'audio/mpeg',buffer:Buffer.alloc(1024)});
        await dialog.getByLabel('Portada JPG o PNG (máximo 3 MB)',{exact:true}).setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.alloc(100)});
        await dialog.getByRole('checkbox',{name:'Confirmo que tengo autorización para publicarlo.',exact:true}).check();
        await dialog.getByRole('button',{name:'Enviar a revisión',exact:true}).click();
        await f.page.getByRole('dialog',{name:'Ingresar',exact:true}).waitFor();
        assert.equal(await f.page.getByRole('button',{name:'Test Artist · Salir',exact:true}).count(),0);
      }finally{await f.page.close();}
    });
    await t.test('login errors remain inside the named dialog and keyboard controls cover account forms',async()=>{
      const f=await fixture();
      try{
        let dialog=await f.open('Ingresar');
        assert.equal(await dialog.getAttribute('aria-label'),'Ingresar');
        await dialog.getByLabel('Correo',{exact:true}).fill('artist@example.test');
        await dialog.getByLabel('Contraseña',{exact:true}).fill('synthetic-passphrase');
        await dialog.getByRole('button',{name:'Ingresar',exact:true}).click();
        await dialog.getByRole('status').filter({hasText:'Credenciales inválidas'}).waitFor();
        await f.page.keyboard.press('Escape');
        for(const name of ['Crear cuenta','Olvidé mi contraseña','Reenviar verificación']){
          dialog=await f.open(name);
          const close=dialog.getByRole('button',{name:'Cerrar ventana',exact:true});
          await f.page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Cerrar ventana');
          await f.page.keyboard.press('Shift+Tab');assert.equal(await close.evaluate(element=>element===document.activeElement),false);
          await f.page.keyboard.press('Tab');assert.equal(await close.evaluate(element=>element===document.activeElement),true);
          await f.page.keyboard.press('Escape');assert.equal(await f.page.getByRole('dialog').count(),0);
        }
      }finally{await f.page.close();}
    });
  }finally{await browser?.close();await server.close();}
});
