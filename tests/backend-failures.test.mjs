import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as audio,onRequestHead as head} from '../functions/api/tracks/audio/[id].js';
import {onRequestGet as cover} from '../functions/api/tracks/cover/[id].js';
import {onRequestPost as upload} from '../functions/api/tracks/submit.js';
import {onRequestPost as review} from '../functions/api/admin/review.js';
import {onRequestPost as publication} from '../functions/api/admin/publication.js';
import {onRequestGet as adminTracks} from '../functions/api/admin/tracks.js';
import {onRequestGet as history} from '../functions/api/admin/history.js';
import {onRequestGet as me} from '../functions/api/auth/me.js';

const origin='https://dubstepwacho.pages.dev',id='11111111-1111-4111-8111-111111111111';
const failure=()=>{throw Error('synthetic-private-schema-or-object-key');};
const track={audio_key:'private/audio.mp3',cover_key:'private/cover.png'};
const DB={prepare(){return {bind(){return {first:async()=>track};}};}};
const store={async head(){return {size:10};},async get(){return {body:new Uint8Array(10)};}};
const context=env=>({env,params:{id},request:new Request(`${origin}/api/tracks/audio/${id}`)});

async function checkUnavailable(result,headOnly=false){
  assert.equal(result.status,503);
  assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal(result.headers.get('X-Content-Type-Options'),'nosniff');
  assert.equal(await result.text(),headOnly?'':'Unavailable');
}

test('public audio and artwork return generic uncached 503 for D1 lookup failures',async()=>{
  for(const handler of [audio,head,cover])await checkUnavailable(await handler(context({DB:{prepare:failure},PRIVATE_MUSIC:store})),handler===head);
});

test('R2 metadata and object read failures never expose internal details',async()=>{
  await checkUnavailable(await audio(context({DB,PRIVATE_MUSIC:{...store,head:failure}})));
  await checkUnavailable(await head(context({DB,PRIVATE_MUSIC:{...store,head:failure}})),true);
  await checkUnavailable(await audio(context({DB,PRIVATE_MUSIC:{...store,get:failure}})));
  await checkUnavailable(await cover(context({DB,PRIVATE_MUSIC:{...store,get:failure}})));
});

test('HEAD failures and missing media have no body and cannot be cached',async()=>{
  for(const env of [{},{DB:{prepare(){return {bind(){return {first:async()=>null};}};}},PRIVATE_MUSIC:store}]){
    const result=await head(context(env));
    assert.ok([404,503].includes(result.status));
    assert.equal(result.headers.get('Cache-Control'),'no-store');
    assert.equal(await result.text(),'');
  }
});

test('session lookup failures deny all protected entry points without leaking schema errors',async()=>{
  const request=new Request(`${origin}/api/test`,{method:'POST',headers:{Origin:origin,Cookie:`dw_session=${'a'.repeat(64)}`}});
  const env={AUTH_ENABLED:'true',UPLOADS_ENABLED:'true',DB:{prepare:failure},PRIVATE_MUSIC:{put:failure}};
  for(const handler of [me,upload,review,publication,adminTracks,history]){
    const result=await handler({env,request});
    assert.equal(result.status,503);
    assert.equal(result.headers.get('Cache-Control'),'no-store');
    assert.deepEqual(await result.json(),{error:'No se pudo comprobar la sesión.'});
  }
});
