import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {onRequestPost as reset} from '../functions/api/auth/reset.js';
import {newEmailToken} from '../functions/api/_email.js';

globalThis.crypto ??= webcrypto;
const url='https://dubstepwacho.pages.dev/api/auth/reset';
const request=(token,password)=>new Request(url,{method:'POST',headers:{Origin:'https://dubstepwacho.pages.dev','Content-Type':'application/json'},body:JSON.stringify({token,password})});

function database(record=null,changes=1){
  const statements=[];
  return {statements,batch:async()=>[{meta:{changes}},{meta:{changes}},{meta:{changes}}],prepare(sql){return {bind(...args){
    statements.push({sql,args});
    return {run:async()=>({meta:{changes:1}}),first:async()=>sql.includes('auth_attempts')?{count:1}:record};
  }}}};
}

test('password reset denies short passwords and unknown tokens',async()=>{
  const token=await newEmailToken();
  assert.equal((await reset({request:request(token.token,'weak'),env:{AUTH_ENABLED:'true',DB:database()}})).status,400);
  assert.equal((await reset({request:request(token.token,'a-good-passphrase-2026'),env:{AUTH_ENABLED:'true',DB:database()}})).status,400);
});
test('password reset revokes every session after changing credentials',async()=>{
  const token=await newEmailToken(),db=database({user_id:'u1'});
  const result=await reset({request:request(token.token,'a-good-passphrase-2026'),env:{AUTH_ENABLED:'true',DB:db}});
  assert.equal(result.status,200);
  assert.ok(db.statements.some(s=>s.sql.includes('password_hash=?')&&s.args[2]==='u1'));
  assert.ok(db.statements.some(s=>s.sql.includes('password_hash=?')&&s.sql.includes('token_hash=? AND expires_at>?')));
  assert.ok(db.statements.some(s=>s.sql.includes('DELETE FROM sessions WHERE user_id=?')));
  assert.ok(db.statements.some(s=>s.sql.includes('DELETE FROM password_resets')));
});
test('password reset rejects a token consumed by a concurrent request',async()=>{
  const token=await newEmailToken(),db=database({user_id:'u1'},0);
  const result=await reset({request:request(token.token,'a-good-passphrase-2026'),env:{AUTH_ENABLED:'true',DB:db}});
  assert.equal(result.status,409);
  assert.ok(db.statements.some(s=>s.sql.includes('DELETE FROM sessions')&&s.sql.includes('changes()>0')));
});
