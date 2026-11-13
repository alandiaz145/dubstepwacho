import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {onRequestPost} from '../functions/api/auth/verify.js';
import {newEmailToken} from '../functions/api/_email.js';

globalThis.crypto ??= webcrypto;
const url='https://dubstepwacho.pages.dev/api/auth/verify';
const request=token=>new Request(url,{method:'POST',headers:{Origin:'https://dubstepwacho.pages.dev','Content-Type':'application/json'},body:JSON.stringify({token})});

function database(row=null,changes=1){
  const operations=[];
  return {operations,batch:async()=>[{meta:{changes}},{meta:{changes:1}}],prepare(sql){
    return {bind(...params){
      operations.push({sql,params});
      return {run:async()=>({meta:{changes}}),first:async()=>{
        if(sql.includes('auth_attempts'))return {count:1};
        return row;
      }};
    }};
  }};
}

test('email confirmation rejects malformed, absent and expired tokens',async()=>{
  const db=database();
  const env={DB:db,AUTH_ENABLED:'true'};
  assert.equal((await onRequestPost({request:request('bad'),env})).status,400);
  const valid=await newEmailToken();
  assert.equal((await onRequestPost({request:request(valid.token),env})).status,400);
});

test('email confirmation updates only the token owner and consumes the token',async()=>{
  const db=database({user_id:'member-id'}),token=await newEmailToken();
  const res=await onRequestPost({request:request(token.token),env:{DB:db,AUTH_ENABLED:'true'}});
  assert.equal(res.status,200);
  assert.ok(db.operations.some(x=>x.sql.includes('email_verified_at=CURRENT_TIMESTAMP')&&x.params[0]==='member-id'));
  assert.ok(db.operations.some(x=>x.sql.includes('DELETE FROM email_verifications')));
});
