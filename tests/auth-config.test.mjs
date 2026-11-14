import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/auth/config.js';

const db={prepare(){return {}}};

test('public registration configuration is disabled by default', async()=>{
  const result=await onRequestGet({env:{DB:db}});
  assert.deepEqual(await result.json(),{registrationEnabled:false,turnstileSiteKey:null});
});

test('registration requires Turnstile, email delivery and an explicit feature flag', async()=>{
  for(const env of [
    {DB:db,AUTH_ENABLED:'true'},
    {DB:db,AUTH_ENABLED:'true',TURNSTILE_SITE_KEY:'public',TURNSTILE_SECRET_KEY:'private'},
    {DB:db,AUTH_ENABLED:'true',TURNSTILE_SITE_KEY:'public',TURNSTILE_SECRET_KEY:'private',RESEND_API_KEY:'provider-secret'},
    {DB:db,AUTH_ENABLED:'true',TURNSTILE_SITE_KEY:'public',TURNSTILE_SECRET_KEY:'private',VERIFICATION_EMAIL_FROM:'test@example.com'},
    {DB:db,AUTH_ENABLED:'true',TURNSTILE_SITE_KEY:'public'},
    {DB:db,AUTH_ENABLED:'true',TURNSTILE_SECRET_KEY:'private'},
    {DB:db,TURNSTILE_SITE_KEY:'public',TURNSTILE_SECRET_KEY:'private'}
  ]){
    const result=await onRequestGet({env});
    assert.equal((await result.json()).registrationEnabled,false);
  }
  const result=await onRequestGet({env:{DB:db,AUTH_ENABLED:'true',TURNSTILE_SITE_KEY:'public',TURNSTILE_SECRET_KEY:'private',RESEND_API_KEY:'provider-secret',VERIFICATION_EMAIL_FROM:'test@example.com'}});
  const data=await result.json();
  assert.deepEqual(data,{registrationEnabled:true,turnstileSiteKey:'public'});
  assert.doesNotMatch(JSON.stringify(data),/private|provider-secret|test@example\.com/);
});
