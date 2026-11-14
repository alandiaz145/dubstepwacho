import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const origin='https://dubstepwacho.test';
test('account lifecycle, session revocation and private range streaming run on local Cloudflare',{timeout:60000},async()=>{
  const sent=[];
  const mf=new Miniflare({
    host:'127.0.0.1',modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:fileURLToPath(new URL('worker.js',import.meta.url)),
    compatibilityDate:'2026-07-01',d1Databases:['DB'],r2Buckets:['PRIVATE_MUSIC'],d1Persist:false,r2Persist:false,
    bindings:{AUTH_ENABLED:'true',TURNSTILE_SECRET_KEY:'test-only',RESEND_API_KEY:'test-only',VERIFICATION_EMAIL_FROM:'test@example.test'},
    outboundService:async request=>{
      const url=new URL(request.url);
      if(url.hostname==='challenges.cloudflare.com')return Response.json({success:true,hostname:'dubstepwacho.test'});
      assert.equal(url.href,'https://api.resend.com/emails');
      sent.push(await request.json());return Response.json({id:'test-only'});
    }
  });
  try{
    const db=await mf.getD1Database('DB');
    const migrations=new URL('../../migrations/',import.meta.url);
    for(const name of readdirSync(migrations).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
      const sql=readFileSync(new URL(name,migrations),'utf8').replace(/^--.*$/gm,'');
      await db.batch(sql.split(';').map(query=>query.trim()).filter(Boolean).map(query=>db.prepare(query)));
    }
    const post=(path,data,cookie='')=>mf.dispatchFetch(`${origin}/api/auth/${path}`,{
      method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)
    });
    const registration=await post('register',{email:'artist@example.test',displayName:'Test artist',role:'artist',password:'runtime-test-passphrase',turnstileToken:'test-only'});
    assert.equal(registration.status,202,await registration.text());
    assert.equal(sent.length,1);
    const linkToken=(index,name)=>new URL(sent[index].text.match(/https:\/\/[^\s]+/)[0]).searchParams.get(name);
    const credentials={email:'artist@example.test',password:'runtime-test-passphrase'};
    assert.equal((await post('login',credentials)).status,401);
    assert.equal((await post('verify',{token:linkToken(0,'verify')})).status,200);
    assert.equal((await post('verify',{token:linkToken(0,'verify')})).status,400);
    const loggedIn=await post('login',credentials);
    assert.equal(loggedIn.status,200,await loggedIn.text());
    const cookie=loggedIn.headers.get('Set-Cookie').split(';')[0];
    const identity=await mf.dispatchFetch(`${origin}/api/auth/me`,{headers:{Cookie:cookie}});
    assert.equal((await identity.json()).user.role,'artist');
    assert.equal((await post('login',credentials)).status,200);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM sessions').first()).n,2);
    assert.equal((await post('forgot',{email:credentials.email,turnstileToken:'test-only'})).status,200);
    const resetToken=linkToken(1,'reset');
    assert.equal((await post('reset',{token:resetToken,password:'runtime-replacement-passphrase'})).status,200);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM sessions').first()).n,0);
    assert.equal((await post('reset',{token:resetToken,password:'runtime-replacement-passphrase'})).status,400);
    const stale=await mf.dispatchFetch(`${origin}/api/auth/me`,{headers:{Cookie:cookie}});
    assert.equal((await stale.json()).user,null);
    assert.equal((await post('login',credentials)).status,401);
    const newLogin=await post('login',{...credentials,password:'runtime-replacement-passphrase'});
    assert.equal(newLogin.status,200,await newLogin.text());
    const newCookie=newLogin.headers.get('Set-Cookie').split(';')[0];
    assert.equal((await post('logout',{},newCookie)).status,200);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM sessions').first()).n,0);

    const user=await db.prepare('SELECT id FROM users').first();
    const id='11111111-1111-4111-8111-111111111111';
    const key=`quarantine/${id}/audio.mp3`;
    const bucket=await mf.getR2Bucket('PRIVATE_MUSIC');
    await bucket.put(key,new Uint8Array([0,1,2,3,4,5,6,7,8,9]));
    await db.prepare(`INSERT INTO tracks(id,user_id,title,artist_name,genre,audio_key,cover_key,audio_bytes,audio_sha256,status,scan_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.id,'Synthetic test','Test Artist','Dubstep',key,`quarantine/${id}/cover.png`,10,'test-only','published','clean').run();
    const audioUrl=`${origin}/api/tracks/audio/${id}`;
    const range=await mf.dispatchFetch(audioUrl,{headers:{Range:'bytes=2-5'}});
    assert.equal(range.status,206);
    assert.equal(range.headers.get('Content-Range'),'bytes 2-5/10');
    assert.equal(range.headers.get('Cache-Control'),'no-store');
    assert.deepEqual([...new Uint8Array(await range.arrayBuffer())],[2,3,4,5]);
    const head=await mf.dispatchFetch(audioUrl,{method:'HEAD',headers:{Range:'bytes=2-5'}});
    assert.equal(head.status,206);
    assert.equal(head.headers.get('Content-Length'),'4');
    assert.equal(await head.text(),'');
    const unsatisfiable=await mf.dispatchFetch(audioUrl,{headers:{Range:'bytes=999-'}});
    assert.equal(unsatisfiable.status,416);
    assert.equal(unsatisfiable.headers.get('Content-Range'),'bytes */10');
    await db.prepare("UPDATE tracks SET status='withdrawn' WHERE id=?").bind(id).run();
    assert.equal((await mf.dispatchFetch(audioUrl)).status,404);
    assert.ok(await bucket.head(key),'withdrawal denies access without relying on deleting the private object');
  }finally{await mf.dispose();}
});
