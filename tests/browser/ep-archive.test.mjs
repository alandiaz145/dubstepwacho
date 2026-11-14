import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';

const volumes=[{slug:'vol-a',title:'Synthetic Volume A',number:1,year:2026},{slug:'vol-b',title:'Synthetic Volume B',number:2,year:2026}];
test('EP archive distinguishes pending, empty and failed reads and ignores obsolete selections',{timeout:60000},async t=>{
  const server=await createServer({server:{host:'127.0.0.1',port:5218,strictPort:false}});let browser;
  try{
    await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
    browser=await chromium.launch({executablePath:process.env.DW_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,timeout:15000,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const fixture=async handler=>{
      const page=await browser.newPage();page.setDefaultTimeout(10000);
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
        if(url.pathname.startsWith('/api/eps/'))return handler(route,url.pathname);
        if(url.pathname.startsWith('/api/'))return route.fulfill({json:{user:null,registrationEnabled:false,tracks:[]}});
        return route.continue();
      });
      await page.goto(base);await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name:'EP colectivo',exact:true}).click();
      return page;
    };
    await t.test('index failures show a retry and an empty successful archive does not advertise volumes',async()=>{
      let requests=0,failing=true;
      const page=await fixture(route=>{requests++;return failing?route.fulfill({status:503,json:{volumes:[]}}):route.fulfill({json:{volumes:[]}});});
      try{
        await page.getByRole('status').filter({hasText:'No pudimos cargar las ediciones'}).waitFor();
        failing=false;await page.getByRole('button',{name:'Reintentar ediciones',exact:true}).click();
        await page.getByRole('region',{name:'Archivo de EPs'}).waitFor({state:'detached'});
        assert.ok(requests>=2);
      }finally{await page.close();}
    });
    await t.test('track reads show loading before empty and allow retry after an error',async()=>{
      let release,attempts=0;
      const gate=new Promise(resolve=>{release=resolve;});
      const page=await fixture(async(route,path)=>{
        if(path==='/api/eps/')return route.fulfill({json:{volumes}});
        if(++attempts===1){await gate;return route.fulfill({status:503,json:{error:'Synthetic failure'}});}
        return route.fulfill({json:{tracks:[]}});
      });
      try{
        await page.getByRole('button',{name:/Synthetic Volume A/}).click();
        await page.getByRole('status').filter({hasText:'Cargando canciones'}).waitFor();
        assert.equal(await page.getByText('Este volumen todavía no tiene canciones públicas.',{exact:true}).count(),0);
        release();await page.getByRole('button',{name:'Reintentar canciones',exact:true}).click();
        await page.getByText('Este volumen todavía no tiene canciones públicas.',{exact:true}).waitFor();
        assert.equal(attempts,2);
      }finally{release();await page.close();}
    });
    await t.test('a delayed earlier volume cannot overwrite the latest selection',async()=>{
      let release;const gate=new Promise(resolve=>{release=resolve;});
      const page=await fixture(async(route,path)=>{
        if(path==='/api/eps/')return route.fulfill({json:{volumes}});
        if(path.endsWith('vol-a')){
          await gate;try{return await route.fulfill({json:{tracks:[{id:'old',title:'Obsolete Track',artist:'Old Artist',position:1}]}});}catch{return;}
        }
        return route.fulfill({json:{tracks:[{id:'latest',title:'Latest Track',artist:'Test Artist',position:1}]}});
      });
      try{
        await page.getByRole('button',{name:/Synthetic Volume A/}).click();
        await page.getByRole('status').filter({hasText:'Cargando canciones'}).waitFor();
        await page.getByRole('button',{name:/Synthetic Volume B/}).click();
        await page.getByRole('button',{name:/Latest Track/}).waitFor();release();
        await page.getByRole('button',{name:/Synthetic Volume B/,pressed:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:/Obsolete Track/}).count(),0);
        assert.equal(await page.getByRole('button',{name:/Latest Track/}).count(),1);
      }finally{release();await page.close();}
    });
  }finally{await browser?.close();await server.close();}
});
