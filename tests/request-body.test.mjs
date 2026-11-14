import test from 'node:test';
import assert from 'node:assert/strict';
import {body} from '../functions/api/_auth.js';
import {onRequestPost as login} from '../functions/api/auth/login.js';
import {onRequestPost as reset} from '../functions/api/auth/reset.js';

const request = value => new Request('https://dubstepwacho.pages.dev/api/auth/login', {
  method:'POST', headers:{Origin:'https://dubstepwacho.pages.dev'}, body:value
});

test('JSON request reader accepts objects and rejects invalid shapes and encoding',async()=>{
  assert.deepEqual(await body(request('{"displayName":"Ñawi"}')),{displayName:'Ñawi'});
  for(const raw of ['null','[]','"text"','1','true','','{']) await assert.rejects(body(request(raw)));
  await assert.rejects(body(request(new Uint8Array([123,34,120,34,58,34,255,34,125]))));
});

test('request size limit counts UTF-8 bytes, including bodies without Content-Length',async()=>{
  assert.equal((await body(request(JSON.stringify({x:'a'.repeat(8184)})))).x.length,8184);
  await assert.rejects(body(request(JSON.stringify({x:'a'.repeat(8185)}))),/body_too_large/);
  await assert.rejects(body(request(JSON.stringify({x:'ñ'.repeat(4093)}))),/body_too_large/);
  const declared=request('{}');
  declared.headers.set('Content-Length','8193');
  await assert.rejects(body(declared),/body_too_large/);
});

test('oversized streamed bodies are cancelled before the remaining payload is read',async()=>{
  let cancelled=false;
  let reads=0;
  const stream=new ReadableStream({
    pull(controller){reads++;controller.enqueue(new Uint8Array(4096));},
    cancel(){cancelled=true;}
  },{highWaterMark:0});
  const req=new Request('https://example.com',{method:'POST',body:stream,duplex:'half'});
  await assert.rejects(body(req),/body_too_large/);
  assert.equal(cancelled,true);
  assert.equal(reads,3);
});

test('login and recovery reject null JSON with 400 before account queries',async()=>{
  const env={AUTH_ENABLED:'true',DB:{prepare(sql){
    assert.match(sql,/auth_attempts/);
    return {bind(){return {run:async()=>({}),first:async()=>({count:1})}}};
  }}};
  for(const endpoint of [login,reset]){
    const result=await endpoint({request:request('null'),env});
    assert.equal(result.status,400);
    assert.equal(result.headers.get('Cache-Control'),'no-store');
  }
});
