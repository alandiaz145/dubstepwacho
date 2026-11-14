import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {migratedDatabase} from './helpers/d1.mjs';
import {onRequestPost as publication} from '../functions/api/admin/publication.js';
import {onRequestGet as list} from '../functions/api/tracks/index.js';
import {onRequestGet as audio,onRequestHead as head} from '../functions/api/tracks/audio/[id].js';
import {onRequestGet as cover} from '../functions/api/tracks/cover/[id].js';

const origin='https://dubstepwacho.pages.dev';
const id='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(64);
function fixture(){
  const db=migratedDatabase();
  db.sql.prepare(`INSERT INTO users(id,email,display_name,role,password_hash,password_salt,email_verified_at)
    VALUES (?,?,?,?,?,?,?)`).run('admin','admin@example.test','Admin','admin','hash','salt','verified');
  db.sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'),'admin',Math.floor(Date.now()/1000)+3600);
  db.sql.prepare(`INSERT INTO tracks(id,user_id,title,artist_name,genre,audio_key,cover_key,audio_bytes,audio_sha256,status,scan_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id,'admin','Synthetic test','Test artist','Dubstep','quarantine/test/audio.mp3','quarantine/test/cover.png',10,'test-hash','approved','clean');
  const reads=[];
  const env={DB:db.DB,AUTH_ENABLED:'true',PRIVATE_MUSIC:{
    async head(key){reads.push(key);return {size:10};},
    async get(key,options){
      reads.push(key);
      const bytes=new Uint8Array(10);
      return {body:options?.range?bytes.slice(options.range.offset,options.range.offset+options.range.length):bytes};
    }
  }};
  const context=(method='GET',range)=>({env,params:{id},request:new Request(`${origin}/api/tracks/audio/${id}`,{
    method,headers:range?{Range:range}:{}
  })});
  const act=action=>publication({env,request:new Request(`${origin}/api/admin/publication`,{
    method:'POST',headers:{Origin:origin,Cookie:`dw_session=${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({id,action,reason:'Synthetic withdrawal test'})
  })});
  return {...db,env,reads,context,act};
}

test('published media disables caches and withdrawal removes every public entry point',async()=>{
  const f=fixture();
  try{
    assert.equal((await audio(f.context())).status,404);
    assert.equal(f.reads.length,0);
    assert.equal((await f.act('publish')).status,200);
    for(const [handler,ctx,status] of [
      [audio,f.context(),200],[audio,f.context('GET','bytes=0-1'),206],
      [head,f.context('HEAD','bytes=0-1'),206],[cover,f.context(),200]
    ]){
      const result=await handler(ctx);
      assert.equal(result.status,status);
      assert.equal(result.headers.get('Cache-Control'),'no-store');
      await result.arrayBuffer();
    }
    assert.equal((await (await list({env:f.env})).json()).tracks.length,1);
    assert.equal((await f.act('withdraw')).status,200);
    f.reads.length=0;
    for(const handler of [audio,head,cover])assert.equal((await handler(f.context())).status,404);
    assert.equal(f.reads.length,0);
    assert.deepEqual((await (await list({env:f.env})).json()).tracks,[]);
    assert.deepEqual(f.sql.prepare('SELECT action FROM moderation_events ORDER BY rowid').all().map(row=>row.action),['publish','withdraw']);
  }finally{f.close();}
});

test('a published track with a revoked clean verdict is denied before private object access',async()=>{
  const f=fixture();
  try{
    assert.equal((await f.act('publish')).status,200);
    f.sql.prepare("UPDATE tracks SET scan_status='infected' WHERE id=?").run(id);
    for(const handler of [audio,head,cover])assert.equal((await handler(f.context())).status,404);
    assert.equal(f.reads.length,0);
    assert.deepEqual((await (await list({env:f.env})).json()).tracks,[]);
  }finally{f.close();}
});
