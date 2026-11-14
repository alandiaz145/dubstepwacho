import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword} from '../../functions/api/_auth.js';
import {origin,startRuntime} from './helpers.mjs';

test('private upload, clean-review gate, publication, withdrawal and audit rollback run on local D1/R2',{timeout:60000},async()=>{
  const f=await startRuntime({UPLOADS_ENABLED:'true'});
  try{
    const credentials=await hashPassword('runtime-test-passphrase');
    for(const role of ['artist','admin','listener'])await f.db.prepare(`INSERT INTO users(id,email,display_name,role,password_hash,password_salt,email_verified_at)
      VALUES (?,?,?,?,?,?,?)`).bind(role,`${role}@example.test`,role,role,credentials.hash,credentials.salt,'verified').run();
    const post=(path,data,cookie='',source=origin)=>f.mf.dispatchFetch(`${origin}${path}`,{
      method:'POST',headers:{Origin:source,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)
    });
    const cookies={};
    for(const role of ['artist','admin','listener']){
      const result=await post('/api/auth/login',{email:`${role}@example.test`,password:'runtime-test-passphrase'});
      assert.equal(result.status,200);cookies[role]=result.headers.get('Set-Cookie').split(';')[0];
    }
    const upload=async cookie=>{
      const form=new FormData();
      for(const [key,value] of Object.entries({title:'Synthetic test',artist:'Test artist',genre:'Dubstep',rights:'true'}))form.set(key,value);
      const audio=new Uint8Array(1024);audio.set([73,68,51,4]);
      const artwork=new Uint8Array(100);artwork.set([137,80,78,71,13,10,26,10]);
      form.set('mp3',new File([audio],'test.mp3'));form.set('cover',new File([artwork],'test.png'));
      const encoded=new Request(origin,{method:'POST',body:form});const body=await encoded.arrayBuffer();
      return f.mf.dispatchFetch(`${origin}/api/tracks/submit`,{method:'POST',body,headers:{
        Origin:origin,Cookie:cookie,'Content-Type':encoded.headers.get('Content-Type'),'Content-Length':String(body.byteLength)
      }});
    };
    const catalog=async()=> (await (await f.mf.dispatchFetch(`${origin}/api/tracks/`)).json()).tracks;
    assert.equal((await f.mf.dispatchFetch(`${origin}/api/admin/tracks`)).status,401);
    assert.equal((await f.mf.dispatchFetch(`${origin}/api/admin/history`,{headers:{Cookie:cookies.artist}})).status,403);
    assert.equal((await upload(cookies.listener)).status,403);
    const submitted=await upload(cookies.artist);
    assert.equal(submitted.status,202,await submitted.clone().text());
    const data=await submitted.json(),id=data.id;
    assert.equal(data.status,'pending_analysis');
    assert.doesNotMatch(JSON.stringify(data),/quarantine|audio_key|cover_key/);
    const record=await f.db.prepare('SELECT * FROM tracks WHERE id=?').bind(id).first();
    assert.equal(record.scan_status,'pending');
    assert.equal((await f.bucket.head(record.audio_key)).size,1024);
    assert.equal((await f.bucket.head(record.cover_key)).size,100);
    const audioUrl=`${origin}/api/tracks/audio/${id}`,coverUrl=`${origin}/api/tracks/cover/${id}`;
    assert.equal((await f.mf.dispatchFetch(audioUrl)).status,404);
    assert.equal((await f.mf.dispatchFetch(coverUrl)).status,404);
    assert.deepEqual(await catalog(),[]);
    assert.equal((await post('/api/admin/review',{id,action:'approve'},cookies.admin)).status,409);
    assert.equal((await post('/api/admin/publication',{id,action:'publish'},cookies.admin)).status,409);
    assert.equal((await post('/api/admin/review',{id,action:'approve'},cookies.artist)).status,403);
    assert.equal((await post('/api/admin/review',{id,action:'approve'},cookies.admin,'https://other.test')).status,403);

    // Fixture-only simulated verdict. There is deliberately no public scanner endpoint.
    await f.db.prepare("UPDATE tracks SET scan_status='clean',status='pending_review' WHERE id=?").bind(id).run();
    assert.equal((await post('/api/admin/review',{id,action:'approve'},cookies.admin)).status,200);
    assert.equal((await post('/api/admin/review',{id,action:'approve'},cookies.admin)).status,409);
    assert.equal((await f.mf.dispatchFetch(audioUrl)).status,404);
    assert.equal((await post('/api/admin/publication',{id,action:'publish'},cookies.admin)).status,200);
    assert.equal((await catalog()).length,1);
    const range=await f.mf.dispatchFetch(audioUrl,{headers:{Range:'bytes=0-3'}});
    assert.equal(range.status,206);
    assert.deepEqual([...new Uint8Array(await range.arrayBuffer())],[73,68,51,4]);
    assert.equal((await f.mf.dispatchFetch(coverUrl)).status,200);
    assert.equal((await post('/api/admin/publication',{id,action:'withdraw',reason:'Synthetic test'},cookies.admin)).status,200);
    assert.deepEqual(await catalog(),[]);
    assert.equal((await f.mf.dispatchFetch(audioUrl)).status,404);
    assert.equal((await f.mf.dispatchFetch(coverUrl)).status,404);
    const history=await f.mf.dispatchFetch(`${origin}/api/admin/history`,{headers:{Cookie:cookies.admin}});
    assert.equal(history.status,200);
    assert.deepEqual((await history.json()).events.map(event=>event.action).sort(),['submitted','approve','publish','withdraw'].sort());

    const second=await (await upload(cookies.artist)).json();
    await f.db.prepare("UPDATE tracks SET scan_status='clean',status='pending_review' WHERE id=?").bind(second.id).run();
    await f.db.prepare(`CREATE TRIGGER fail_audit BEFORE INSERT ON moderation_events WHEN NEW.action='approve'
      BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END`).run();
    assert.equal((await post('/api/admin/review',{id:second.id,action:'approve'},cookies.admin)).status,500);
    assert.equal((await f.db.prepare('SELECT status FROM tracks WHERE id=?').bind(second.id).first()).status,'pending_review');
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM moderation_events WHERE track_id=? AND action='approve'").bind(second.id).first()).n,0);
    assert.equal(f.sent.length,0);
  }finally{await f.close();}
});
