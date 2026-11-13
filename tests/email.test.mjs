import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {emailDeliveryReady,newEmailToken,hashEmailToken,sendVerificationEmail,sendPasswordResetEmail} from '../functions/api/_email.js';

globalThis.crypto ??= webcrypto;

test('confirmation tokens are random, hashed and expire',async()=>{
  const a=await newEmailToken(),b=await newEmailToken();
  assert.equal(a.token.length,64);
  assert.notEqual(a.token,b.token);
  assert.equal(await hashEmailToken(a.token),a.tokenHash);
  assert.ok(a.expiresAt>Math.floor(Date.now()/1000));
});
test('email delivery is disabled without a verified provider configuration',async()=>{
  assert.equal(emailDeliveryReady({}),false);
  assert.equal(await sendVerificationEmail({}, {to:'test@example.com',displayName:'Test',token:'xyz',origin:'https://dubstepwacho.pages.dev'}),false);
});
test('mail adapter sends a confirmation link without exposing the provider key',async()=>{
  const env={RESEND_API_KEY:'secret',VERIFICATION_EMAIL_FROM:'DubstepWacho <hola@example.com>'};
  const sent=await sendVerificationEmail(env,{to:'test@example.com',displayName:'Test',token:'token1',origin:'https://dubstepwacho.pages.dev'},async(url,opts)=>{
    assert.equal(url,'https://api.resend.com/emails');
    assert.equal(opts.headers.Authorization,'Bearer secret');
    const body=JSON.parse(opts.body);
    assert.deepEqual(body.to,['test@example.com']);
    assert.match(body.text,/\?verify=token1/);
    assert.doesNotMatch(body.text,/secret/);
    return new Response('{}',{status:200});
  });
  assert.equal(sent,true);
});
test('password recovery message expires in 30 minutes and uses a distinct link',async()=>{
  const token=await newEmailToken(1800);
  assert.ok(token.expiresAt-Math.floor(Date.now()/1000)<=1800);
  const env={RESEND_API_KEY:'key',VERIFICATION_EMAIL_FROM:'hola@example.com'};
  const result=await sendPasswordResetEmail(env,{to:'test@example.com',displayName:'Test',token:'secret-token',origin:'https://dubstepwacho.pages.dev'},async(_,opts)=>{
    const data=JSON.parse(opts.body);
    assert.match(data.text,/\?reset=secret-token/);
    assert.doesNotMatch(data.text,/\?verify=/);
    return new Response('{}',{status:200});
  });
  assert.equal(result,true);
});
