import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {hashPassword,verifyPassword,slugify,validEmail,sessionCookie,sameOrigin,ready} from '../functions/api/_auth.js';

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
