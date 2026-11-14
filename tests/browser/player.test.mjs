import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';

const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function silentWav(seconds){
  const rate=8000,length=Math.floor(rate*seconds)*2,buffer=Buffer.alloc(44+length);
  buffer.write('RIFF');buffer.writeUInt32LE(36+length,4);buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);
  buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(length,40);
  return buffer;
}

test('local Chromium verifies dialog keyboard controls and actual synthetic playback',{timeout:60000},async t=>{
  const server=await createServer({server:{host:'127.0.0.1',port:5198,strictPort:false}});
  let browser;
  try{
    await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
    browser=await chromium.launch({executablePath:process.env.DW_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,timeout:15000,
      args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const pageFor=async(count=2,seconds=5,mediaEnabled=true)=>{
      const page=await browser.newPage();
      page.setDefaultTimeout(10000);
      page.testMediaEnabled=mediaEnabled;
      const bytes=silentWav(seconds);
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==base)return route.abort();
        if(url.pathname==='/api/tracks/')return route.fulfill({json:{tracks:ids.slice(0,count).map((id,index)=>({id,title:`Synthetic ${index?'B':'A'}`,artist:'Test Artist',genre:'Dubstep',url:`/api/tracks/audio/${id}`}))}});
        if(url.pathname.startsWith('/api/tracks/audio/')){
          if(!page.testMediaEnabled)return route.fulfill({status:503,body:'Synthetic temporary failure'});
          const range=route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
          const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
          return route.fulfill({status:range?206:200,body:bytes.subarray(start,end+1),headers:{
            'Content-Type':'audio/wav','Accept-Ranges':'bytes','Cache-Control':'no-store',
            ...(range?{'Content-Range':`bytes ${start}-${end}/${bytes.length}`}:{})
          }});
        }
        if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Test fixture: unavailable',registrationEnabled:false,volumes:[]}});
        return route.continue();
      });
      await page.addInitScript(()=>{
        window.testPlayCalls=0;
        const play=HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play=function(...args){window.testPlayCalls++;return play.apply(this,args);};
      });
      await page.goto(base);
      return page;
    };
    await t.test('login dialog traps Tab and Shift+Tab, closes with Escape and restores focus',async()=>{
      const page=await pageFor(0);
      try{
        const trigger=page.getByRole('button',{name:'Ingresar',exact:true}).first();
        await trigger.click();
        const close=page.getByRole('button',{name:'Cerrar ventana',exact:true});
        await close.waitFor();
        assert.equal(await close.evaluate(element=>element===document.activeElement),true);
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.getByRole('button',{name:'Reenviar verificación',exact:true}).evaluate(element=>element===document.activeElement),true);
        await page.keyboard.press('Tab');
        assert.equal(await close.evaluate(element=>element===document.activeElement),true);
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(),0);
        assert.equal(await trigger.evaluate(element=>element===document.activeElement),true);
      }finally{await page.close();}
    });
    await t.test('password recovery clears the stale account and administrative navigation',async()=>{
      const page=await pageFor(0);
      try{
        await page.route('**/api/auth/me',route=>route.fulfill({json:{user:{id:'test-admin',displayName:'Test Admin',role:'admin'}}}));
        await page.route('**/api/auth/reset',route=>route.fulfill({json:{message:'Synthetic recovery completed'}}));
        await page.goto(`${base}/?reset=${'a'.repeat(64)}`);
        await page.getByRole('button',{name:'Test Admin · Salir',exact:true}).waitFor();
        await page.getByLabel('Contraseña nueva',{exact:true}).fill('synthetic-new-passphrase');
        await page.getByRole('button',{name:'Guardar contraseña',exact:true}).click();
        await page.locator('.header-actions').getByRole('button',{name:'Ingresar',exact:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:'Test Admin · Salir',exact:true}).count(),0);
        assert.equal(await page.getByRole('button',{name:'Administración',exact:true}).count(),0);
        assert.equal(new URL(page.url()).searchParams.has('reset'),false);
      }finally{await page.close();}
    });
    await t.test('play, pause, resume, demos, seeking and next track reflect the real audio element',async()=>{
      const page=await pageFor();
      try{
        await page.getByRole('button',{name:'Reproducir Synthetic A',exact:true}).click();
        await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').readyState>=2);
        await page.getByRole('button',{name:'Reproducir Cordillera Riddim',exact:true}).click();
        assert.equal(await page.locator('audio').evaluate(element=>element.paused),false);
        await page.getByRole('button',{name:'Pausar',exact:true}).click();
        assert.equal(await page.locator('audio').evaluate(element=>element.paused),true);
        const seek=page.getByRole('slider',{name:'Avanzar canción',exact:true});
        await seek.focus();await seek.press('Home');await seek.press('ArrowRight');
        assert.ok(Math.abs(await page.locator('audio').evaluate(element=>element.currentTime)-0.1)<0.05);
        await page.getByRole('button',{name:'Reproducir',exact:true}).click();
        await page.waitForFunction(()=>!document.querySelector('audio').paused);
        await page.getByRole('button',{name:'Canción siguiente',exact:true}).click();
        await page.waitForFunction(id=>document.querySelector('audio').src.endsWith(id)&&!document.querySelector('audio').paused,ids[1]);
        assert.equal(await page.locator('.player .now b').textContent(),'Synthetic B');
      }finally{await page.close();}
    });
    await t.test('a failed audio can be retried after the source becomes available',async()=>{
      const page=await pageFor(1,5,false);
      try{
        await page.getByRole('button',{name:'Reproducir Synthetic A',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('audio').error!==null);
        page.testMediaEnabled=true;
        await page.getByRole('button',{name:'Reproducir',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('audio').readyState>=2&&!document.querySelector('audio').paused);
        assert.equal(await page.locator('.player .now b').textContent(),'Synthetic A');
      }finally{await page.close();}
    });
    await t.test('a one-track radio restarts after ending without toggling into pause',async()=>{
      const page=await pageFor(1,0.3);
      try{
        await page.getByRole('button',{name:'Reproducir Synthetic A',exact:true}).click();
        await page.waitForFunction(()=>window.testPlayCalls>=2&&!document.querySelector('audio').paused);
        assert.equal(await page.locator('.player .now b').textContent(),'Synthetic A');
      }finally{await page.close();}
    });
  }finally{await browser?.close();await server.close();}
});
