import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {hashPassword,verifyPassword,slugify,validEmail,sessionCookie,sameOrigin,ready,verifyTurnstile,createSession} from '../functions/api/_auth.js';

globalThis.crypto ??= webcrypto;

test('passwords are salted and checked', async()=>{
  const a=await hashPassword('my-example-passphrase-2026');
  const b=await hashPassword('my-example-passphrase-2026');
  assert.notEqual(a.salt,b.salt);
  assert.notEqual(a.hash,b.hash);
  assert.equal(await verifyPassword('my-example-passphrase-2026',a.salt,a.hash),true);
  assert.equal(await verifyPassword('incorrect-password',a.salt,a.hash),false);
});
test('slugs and email validation',()=>{
  assert.equal(slugify('ÑAWI & Bass'), 'nawi-bass');
  assert.equal(validEmail('user@example.com'),true);
  assert.equal(validEmail('not-an-email'),false);
});
test('cookies are secure and mutations require same origin',()=>{
  assert.match(sessionCookie('test'),/HttpOnly; Secure; SameSite=Lax/);
  assert.equal(sameOrigin(new Request('https://dubstepwacho.pages.dev/api/auth/login',{headers:{Origin:'https://dubstepwacho.pages.dev'}})),true);
  assert.equal(sameOrigin(new Request('https://dubstepwacho.pages.dev/api/auth/login',{headers:{Origin:'https://malicious.example'}})),false);
});
test('binding a database does not activate accounts by itself',()=>{
  const env={DB:{prepare(){}}};
  assert.equal(ready(env),false);
  assert.equal(ready({...env,AUTH_ENABLED:'true'}),true);
});
test('session creation prunes old sessions and commits atomically',async()=>{
  const statements=[];
  const db={prepare(sql){return {bind(...args){return {sql,args}}}},async batch(batch){statements.push(...batch);return [{meta:{changes:0}},{meta:{changes:1}}]}};
  const token=await createSession(db,'artist-1');
  assert.match(token,/^[a-f0-9]{64}$/);
  assert.equal(statements.length,2);
  assert.match(statements[0].sql,/expires_at<=\?/);
  assert.match(statements[0].sql,/OFFSET 9/);
  assert.match(statements[1].sql,/INSERT INTO sessions/);
  assert.equal(statements[1].args[1],'artist-1');
});
test('registration challenge fails closed without credentials or a valid token', async()=>{
  const request=new Request('https://dubstepwacho.pages.dev/api/auth/register');
  let called=false;
  const verifier=async()=>{called=true;return Response.json({success:true,hostname:'dubstepwacho.pages.dev'});};
  assert.equal(await verifyTurnstile({},'token',request,verifier),false);
  assert.equal(await verifyTurnstile({TURNSTILE_SECRET_KEY:'test'},'',request,verifier),false);
  assert.equal(await verifyTurnstile({TURNSTILE_SECRET_KEY:'test'},'x'.repeat(2049),request,verifier),false);
  assert.equal(called,false);
  assert.equal(await verifyTurnstile({TURNSTILE_SECRET_KEY:'test'},'token',request,async()=>{throw Error('offline');}),false);
});
test('registration challenge validates Siteverify response and hostname', async()=>{
  const request=new Request('https://dubstepwacho.pages.dev/api/auth/register',{headers:{'CF-Connecting-IP':'203.0.113.22'}});
  const env={TURNSTILE_SECRET_KEY:'test'};
  const valid=async(url,opts)=>{
    assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(opts.method,'POST');
    assert.equal(opts.body.get('remoteip'),'203.0.113.22');
    return Response.json({success:true,hostname:'dubstepwacho.pages.dev'});
  };
  assert.equal(await verifyTurnstile(env,'good-token',request,valid),true);
  assert.equal(await verifyTurnstile(env,'good-token',request,async()=>Response.json({success:true,hostname:'other.example'})),false);
  assert.equal(await verifyTurnstile(env,'bad-token',request,async()=>Response.json({success:false})),false);
  assert.equal(await verifyTurnstile(env,'bad-token',request,async()=>new Response('bad',{status:500})),false);
});
