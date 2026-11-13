import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {onRequestGet} from '../functions/api/admin/history.js';

globalThis.crypto ??= webcrypto;
const url='https://dubstepwacho.pages.dev/api/admin/history';
const session=`dw_session=${'a'.repeat(64)}`;
const db=(role='admin')=>({
  prepare(sql){return {
    bind(){return {first:async()=>({id:'user-1',role})}},
    all:async()=>{
      assert.match(sql,/FROM moderation_events m/);
      assert.match(sql,/LIMIT 50/);
      return {results:[{action:'publish',trackTitle:'Test autorizado',artistName:'Demo',actorName:'Admin',createdAt:'2026-11-13'}]};
    }
  }}
});
const env=(role)=>({AUTH_ENABLED:'true',DB:db(role)});

test('moderation history requires a signed-in administrator',async()=>{
  assert.equal((await onRequestGet({request:new Request(url),env:env('admin')})).status,401);
  assert.equal((await onRequestGet({request:new Request(url,{headers:{Cookie:session}}),env:env('artist')})).status,403);
});

test('moderation history lists recent audit events to administrators',async()=>{
  const response=await onRequestGet({request:new Request(url,{headers:{Cookie:session}}),env:env('admin')});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.events[0].trackTitle,'Test autorizado');
});
