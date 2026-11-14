import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {migratedDatabase} from './helpers/d1.mjs';
import {onRequestPost as submit} from '../functions/api/tracks/submit.js';

const origin='https://dubstepwacho.pages.dev',token='a'.repeat(64);
async function uploadRequest(){
  const form=new FormData();
  for(const [key,value] of Object.entries({title:'Synthetic test',artist:'Test artist',genre:'Dubstep',rights:'true'}))form.set(key,value);
  const bytes=new Uint8Array(1024);bytes.set([73,68,51,4]);
  const image=new Uint8Array(100);image.set([137,80,78,71,13,10,26,10]);
  form.set('mp3',new File([bytes],'test.mp3'));
  form.set('cover',new File([image],'test.png'));
  const encoded=new Request(origin,{method:'POST',body:form});
  const body=await encoded.arrayBuffer();
  return new Request(`${origin}/api/tracks/submit`,{method:'POST',body,headers:{
    Origin:origin,Cookie:`dw_session=${token}`,'Content-Type':encoded.headers.get('Content-Type'),'Content-Length':String(body.byteLength)
  }});
}

test('concurrent uploads cannot exceed five daily submissions and the loser cleans private objects',async()=>{
  const db=migratedDatabase(),objects=new Map(),removed=[];
  try{
    db.sql.prepare(`INSERT INTO users(id,email,display_name,role,password_hash,password_salt,email_verified_at)
      VALUES (?,?,?,?,?,?,?)`).run('artist','artist@example.test','Artist','artist','hash','salt','verified');
    db.sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)')
      .run(createHash('sha256').update(token).digest('hex'),'artist',Math.floor(Date.now()/1000)+3600);
    for(let i=0;i<4;i++)db.sql.prepare(`INSERT INTO tracks(id,user_id,title,artist_name,genre,audio_key,cover_key,audio_bytes,audio_sha256)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(`existing-${i}`,'artist','Test','Artist','Dubstep',`audio-${i}`,`cover-${i}`,1024,'test-only');
    let uploads=0,release;
    const gate=new Promise(resolve=>{release=resolve;});
    const env={DB:db.DB,AUTH_ENABLED:'true',UPLOADS_ENABLED:'true',PRIVATE_MUSIC:{
      async put(key,value){
        objects.set(key,value);
        if(key.endsWith('/audio.mp3')){uploads++;if(uploads===2)release();await gate;}
      },
      async delete(key){removed.push(key);objects.delete(key);}
    }};
    const requests=await Promise.all([uploadRequest(),uploadRequest()]);
    const results=await Promise.all(requests.map(request=>submit({env,request})));
    assert.deepEqual(results.map(result=>result.status).sort(),[202,429]);
    assert.equal(db.sql.prepare('SELECT count(*) AS n FROM tracks').get().n,5);
    const accepted=await results.find(result=>result.status===202).json();
    assert.deepEqual([...objects.keys()].sort(),[`quarantine/${accepted.id}/audio.mp3`,`quarantine/${accepted.id}/cover.png`].sort());
    assert.equal(removed.length,2);
    assert.equal(db.sql.prepare('SELECT count(*) AS n FROM moderation_events').get().n,1);
    assert.equal(db.sql.prepare('SELECT track_id FROM moderation_events').get().track_id,accepted.id);
    assert.equal(db.sql.prepare('SELECT status FROM tracks WHERE id=?').get(accepted.id).status,'pending_analysis');
    assert.equal((await submit({env,request:await uploadRequest()})).status,429);
    assert.equal(objects.size,2);
  }finally{db.close();}
});
