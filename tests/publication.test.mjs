import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {onRequestPost} from '../functions/api/admin/publication.js';

globalThis.crypto ??= webcrypto;

const id='12345678-1234-1234-1234-1234567890ab';
const url='https://dubstepwacho.pages.dev/api/admin/publication';
const request=(action,reason='')=>new Request(url,{
  method:'POST',headers:{Origin:'https://dubstepwacho.pages.dev',Cookie:`dw_session=${'a'.repeat(64)}`,'Content-Type':'application/json'},
  body:JSON.stringify({id,action,reason})
});
const mockDb=(changes=1)=>{
  const actions=[];
  return {actions,prepare(sql){
    return {bind(...args){return {
      first:async()=>({id:'admin-1',role:'admin'}),
      run:async()=>{actions.push({sql,args});return {meta:{changes}}}
    }}};
  }};
};
const env=db=>({DB:db,AUTH_ENABLED:'true'});

test('publication requires same-origin administrator',async()=>{
  const db=mockDb();
  const spoofed=new Request(url,{method:'POST',headers:{Origin:'https://bad.example',Cookie:`dw_session=${'a'.repeat(64)}`},body:'{}'});
  assert.equal((await onRequestPost({request:spoofed,env:env(db)})).status,403);
  assert.equal(db.actions.length,0);
});
test('publishing only updates reviewed clean tracks',async()=>{
  const db=mockDb();
  const res=await onRequestPost({request:request('publish'),env:env(db)});
  assert.equal(res.status,200);
  assert.match(db.actions[0].sql,/status='approved' AND scan_status='clean'/);
  assert.match(db.actions[1].sql,/moderation_events/);
});
test('invalid state and withdrawals are rejected safely',async()=>{
  const noChanges=mockDb(0);
  assert.equal((await onRequestPost({request:request('publish'),env:env(noChanges)})).status,409);
  assert.equal(noChanges.actions.length,1);
  const db=mockDb();
  assert.equal((await onRequestPost({request:request('withdraw',''),env:env(db)})).status,400);
  const withdrawn=await onRequestPost({request:request('withdraw','Solicitud del autor'),env:env(db)});
  assert.equal(withdrawn.status,200);
  assert.match(db.actions[0].sql,/status='published'/);
});
