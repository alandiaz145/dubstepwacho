import test from 'node:test';
import assert from 'node:assert/strict';
import {preview} from 'vite';
import {chromium} from 'playwright-core';

// Exercise emitted chunks, not Vite's development module loading. Build first.
test('production preview defers optional panels and distant covers without breaking navigation',{timeout:60000},async t=>{
  const server=await preview({preview:{host:'127.0.0.1',port:5249,strictPort:false}});let browser;
  try{
    const base=server.resolvedUrls.local[0],origin=new URL(base).origin;
    browser=await chromium.launch({executablePath:process.env.DW_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
    const fixture=async({mobile=false,chunkHandler,tracks=[]}={})=>{
      const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}}),requests=[];page.setDefaultTimeout(10000);
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();requests.push(url.pathname);
        if(/\/assets\/EpArchive-[^/]+\.js$/.test(url.pathname)&&chunkHandler)return chunkHandler(route);
        if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:{id:'synthetic-admin',role:'admin',displayName:'Test Admin'}}});
        if(url.pathname==='/api/auth/config')return route.fulfill({json:{registrationEnabled:false}});
        if(url.pathname==='/api/tracks/')return route.fulfill({json:{tracks}});
        if(url.pathname.startsWith('/api/tracks/cover/'))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0X8AAAAASUVORK5CYII=','base64')});
        if(url.pathname.startsWith('/api/'))return route.fulfill({json:{tracks:[],events:[],volumes:[]}});
        return route.continue();
      });
      await page.goto(base);await page.getByRole('button',{name:'Test Admin · Salir',exact:true}).waitFor();
      const navigate=async name=>{
        if(mobile)await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
        await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name,exact:true}).click();
      };
      return {page,requests,navigate};
    };
    for(const mobile of [false,true])await t.test(`${mobile?'mobile':'desktop'} loads each panel only when opened`,async()=>{
      const f=await fixture({mobile});
      try{
        assert.equal(f.requests.some(path=>/\/(AdminPanel|EpArchive)-.*\.js$/.test(path)),false);
        assert.equal(f.requests.some(path=>/^\/api\/(admin|eps)\//.test(path)),false);
        const epRead=f.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/eps/');
        await f.navigate('EP colectivo');await epRead;
        assert.equal(f.requests.some(path=>/\/EpArchive-.*\.js$/.test(path)),true);
        assert.equal(f.requests.some(path=>/\/AdminPanel-.*\.js$/.test(path)),false);
        await f.navigate('Administración');await f.page.getByRole('heading',{name:'MODERACIÓN',exact:true}).waitFor();
        await f.page.getByRole('button',{name:'Actualizar listado',exact:true}).waitFor();
        assert.equal(f.requests.some(path=>/\/AdminPanel-.*\.js$/.test(path)),true);
        assert.equal(f.requests.includes('/api/admin/tracks'),true);
      }finally{await f.page.close();}
    });
    await t.test('a failed optional chunk preserves navigation and player and can recover after reload',async()=>{
      let broken=true;const f=await fixture({chunkHandler:route=>broken?route.fulfill({status:503,body:'Synthetic chunk failure'}):route.continue()});
      try{
        await f.navigate('EP colectivo');await f.page.getByRole('button',{name:'Recargar página',exact:true}).waitFor();
        assert.equal(f.requests.includes('/api/eps/'),false);
        assert.equal(await f.page.getByRole('region',{name:'Reproductor de música'}).count(),1);
        await f.navigate('Artistas');await f.page.getByRole('heading',{name:'ARTISTAS',exact:true}).waitFor();
        await f.navigate('EP colectivo');broken=false;
        await f.page.getByRole('button',{name:'Recargar página',exact:true}).click();
        await f.page.getByRole('heading',{name:/EL SONIDO NUEVO/}).waitFor();
        const epRead=f.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/eps/');
        await f.navigate('EP colectivo');await epRead;
        await f.page.getByRole('status').filter({hasText:'Cargando'}).waitFor({state:'detached'});
        assert.equal(await f.page.getByRole('button',{name:'Recargar página',exact:true}).count(),0);
      }finally{await f.page.close();}
    });
    await t.test('leaving a pending panel does not start its API read when the chunk arrives',async()=>{
      let release;const gate=new Promise(resolve=>{release=resolve;});
      const f=await fixture({chunkHandler:async route=>{await gate;return route.continue();}});
      try{
        await f.navigate('EP colectivo');await f.page.getByRole('status').filter({hasText:'Cargando ediciones publicadas'}).waitFor();
        await f.navigate('Artistas');
        const loaded=f.page.waitForResponse(response=>/\/assets\/EpArchive-[^/]+\.js$/.test(new URL(response.url()).pathname));
        release();await loaded;await f.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert.equal(f.requests.includes('/api/eps/'),false);
        await f.page.getByRole('heading',{name:'ARTISTAS',exact:true}).waitFor();
      }finally{release();await f.page.close();}
    });
    await t.test('named search and filter controls work with reduced motion and the queue has a named close action',async()=>{
      const f=await fixture({tracks:[{id:'test-track',title:'Synthetic Search',artist:'Test Artist',genre:'Dubstep',url:'/api/tracks/audio/test-track'}]});
      try{
        await f.page.emulateMedia({reducedMotion:'reduce'});
        assert.equal(await f.page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
        await f.page.getByRole('textbox',{name:'Buscar artistas, tracks o géneros',exact:true}).fill('Synthetic Search');
        await f.page.getByRole('button',{name:'Ver todos los lanzamientos →',exact:true}).click();
        assert.equal(await f.page.getByRole('textbox',{name:'Buscar canción o artista',exact:true}).inputValue(),'Synthetic Search');
        await f.page.getByRole('combobox',{name:'Filtrar por género',exact:true}).selectOption('Riddim');
        await f.page.getByText('No se encontraron canciones.',{exact:true}).waitFor();
        await f.page.getByRole('combobox',{name:'Filtrar por género',exact:true}).selectOption('Dubstep');
        await f.page.getByRole('combobox',{name:'Ordenar lanzamientos',exact:true}).selectOption('Artista');
        await f.page.getByRole('button',{name:'Reproducir Synthetic Search',exact:true}).waitFor();
        await f.page.getByRole('button',{name:'Mostrar cola de reproducción',exact:true}).click();
        await f.page.getByRole('button',{name:'Cerrar cola de reproducción',exact:true}).click();
        assert.equal(await f.page.getByRole('button',{name:'Cerrar cola de reproducción',exact:true}).count(),0);
        await f.navigate('Foro');
        await f.page.getByRole('textbox',{name:'Título del tema de prueba',exact:true}).fill('Synthetic local topic');
        await f.page.getByRole('button',{name:'Crear tema de prueba',exact:true}).click();
        await f.page.getByText('Synthetic local topic',{exact:true}).waitFor();
        assert.equal(f.requests.some(path=>path.startsWith('/api/forum')),false);
      }finally{await f.page.close();}
    });
    await t.test('mobile exploration defers distant real covers until scrolling while preserving square geometry',async()=>{
      const tracks=Array.from({length:100},(_,i)=>({id:`track-${i}`,title:`Synthetic ${String(i).padStart(3,'0')}`,artist:'Test Artist',genre:'Dubstep',url:`/api/tracks/audio/track-${i}`,coverUrl:`/api/tracks/cover/track-${i}`}));
      const f=await fixture({mobile:true,tracks});
      try{
        assert.equal(await f.page.getByAltText('Arte conceptual Raíz Bass',{exact:true}).getAttribute('fetchpriority'),'high');
        await f.page.getByRole('button',{name:'Ver todos los lanzamientos →',exact:true}).click();
        const last=f.page.getByAltText('Portada de Synthetic 099',{exact:true});await last.waitFor({state:'attached'});
        assert.equal(f.requests.includes('/api/tracks/cover/track-99'),false);
        await last.scrollIntoViewIfNeeded();await last.evaluate(image=>image.decode());
        assert.equal(f.requests.includes('/api/tracks/cover/track-99'),true);
        const box=await last.boundingBox();assert.equal(box.width,box.height);assert.equal(box.width,58);
      }finally{await f.page.close();}
    });
  }finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
});
