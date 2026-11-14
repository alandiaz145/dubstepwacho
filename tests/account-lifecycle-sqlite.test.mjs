import test from 'node:test';
import assert from 'node:assert/strict';
import {migratedDatabase} from './helpers/d1.mjs';
import {hashEmailToken} from '../functions/api/_email.js';
import {onRequestPost as register} from '../functions/api/auth/register.js';
import {onRequestPost as verify} from '../functions/api/auth/verify.js';
import {onRequestPost as login} from '../functions/api/auth/login.js';
import {onRequestPost as forgot} from '../functions/api/auth/forgot.js';
import {onRequestPost as reset} from '../functions/api/auth/reset.js';
import {onRequestPost as resend} from '../functions/api/auth/resend.js';
import {onRequestPost as logout} from '../functions/api/auth/logout.js';
import {onRequestGet as me} from '../functions/api/auth/me.js';
import {onRequestGet as adminTracks} from '../functions/api/admin/tracks.js';
import {onRequestPost as upload} from '../functions/api/tracks/submit.js';

const origin='https://dubstepwacho.pages.dev';
const email='artist@example.test';
const password='initial-test-passphrase';
function fixture(){
  const db=migratedDatabase(),sent=[];
  const originalFetch=globalThis.fetch;
  let deliveryStatus=200;
  globalThis.fetch=async(url,options)=>{
    if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify')
      return Response.json({success:true,hostname:'dubstepwacho.pages.dev'});
    assert.equal(url,'https://api.resend.com/emails','tests must never contact a real external service');
    sent.push(JSON.parse(options.body));
    return Response.json({id:'test-only'},{status:deliveryStatus});
  };
  const env={DB:db.DB,AUTH_ENABLED:'true',TURNSTILE_SECRET_KEY:'test-only',RESEND_API_KEY:'test-only',VERIFICATION_EMAIL_FROM:'test@example.test'};
  const request=(path,data={},cookie='')=>new Request(`${origin}/api/${path}`,{method:'POST',headers:{
    Origin:origin,Cookie:cookie,'Content-Type':'application/json'
  },body:JSON.stringify(data)});
  const call=(handler,path,data,cookie='')=>handler({env,request:[me,adminTracks].includes(handler)
    ?new Request(`${origin}/api/${path}`,{headers:{Cookie:cookie}}):request(path,data,cookie)});
  const token=(index,name)=>new URL(sent[index].text.match(/https:\/\/[^\s]+/)[0]).searchParams.get(name);
  const signup=(role='artist')=>call(register,'auth/register',{email,displayName:'Test Artist',password,role,turnstileToken:'test-only'});
  return {...db,env,sent,call,token,signup,deliveryStatus:value=>{deliveryStatus=value;},
    close(){globalThis.fetch=originalFetch;db.close();}
  };
}
const cookie=result=>result.headers.get('Set-Cookie').split(';')[0];

test('account lifecycle: register, verify, login, recover and logout with real migrated SQL',async()=>{
  const f=fixture();
  try{
    assert.equal((await f.signup()).status,202);
    const user=f.sql.prepare('SELECT * FROM users').get();
    assert.equal(user.email_verified_at,null);
    assert.equal(user.role,'artist');
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM artist_profiles').get().n,1);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
    const verification=f.token(0,'verify');
    assert.equal(f.sql.prepare('SELECT token_hash FROM email_verifications').get().token_hash,await hashEmailToken(verification));
    assert.equal((await f.call(login,'auth/login',{email,password})).status,401);
    assert.equal((await f.call(verify,'auth/verify',{token:verification})).status,200);
    assert.equal((await f.call(verify,'auth/verify',{token:verification})).status,400);
    const loggedIn=await f.call(login,'auth/login',{email,password});
    assert.equal(loggedIn.status,200);
    const session=cookie(loggedIn);
    const identity=await (await f.call(me,'auth/me',{},session)).json();
    assert.deepEqual(identity.user,{id:user.id,email,displayName:'Test Artist',role:'artist'});
    assert.equal((await f.call(adminTracks,'admin/tracks',{},session)).status,403);
    assert.equal((await f.call(upload,'tracks/submit',{},session)).status,503);
    assert.equal((await f.call(forgot,'auth/forgot',{email,turnstileToken:'test-only'})).status,200);
    const resetToken=f.token(1,'reset'),replacement='replacement-test-passphrase';
    assert.equal((await f.call(reset,'auth/reset',{token:resetToken,password:replacement})).status,200);
    assert.equal((await (await f.call(me,'auth/me',{},session)).json()).user,null);
    assert.equal((await f.call(login,'auth/login',{email,password})).status,401);
    const newLogin=await f.call(login,'auth/login',{email,password:replacement});
    assert.equal(newLogin.status,200);
    const newSession=cookie(newLogin);
    assert.equal((await f.call(logout,'auth/logout',{},newSession)).status,200);
    assert.equal((await (await f.call(me,'auth/me',{},newSession)).json()).user,null);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
  }finally{f.close();}
});

test('a failed initial email can be resent after cooldown without granting an administrator role',async()=>{
  const f=fixture();
  try{
    f.deliveryStatus(503);
    assert.equal((await f.signup('admin')).status,503);
    assert.equal(f.sql.prepare('SELECT role FROM users').get().role,'listener');
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM artist_profiles').get().n,0);
    const original=f.token(0,'verify');
    f.deliveryStatus(200);
    assert.equal((await f.call(resend,'auth/resend',{email,turnstileToken:'test-only'})).status,200);
    assert.equal(f.sent.length,1);
    f.sql.exec('UPDATE email_verifications SET sent_at=0');
    assert.equal((await f.call(resend,'auth/resend',{email,turnstileToken:'test-only'})).status,200);
    assert.equal(f.sent.length,2);
    assert.equal((await f.call(verify,'auth/verify',{token:original})).status,400);
    assert.equal((await f.call(verify,'auth/verify',{token:f.token(1,'verify')})).status,200);
    assert.equal((await f.call(login,'auth/login',{email,password})).status,200);
  }finally{f.close();}
});

test('failed verification persistence rolls back the new account and artist profile',async()=>{
  const f=fixture();
  try{
    f.sql.exec(`CREATE TRIGGER fail_verification BEFORE INSERT ON email_verifications
      BEGIN SELECT RAISE(ABORT,'simulated database failure'); END;`);
    assert.equal((await f.signup()).status,409);
    for(const table of ['users','artist_profiles','email_verifications','sessions'])
      assert.equal(f.sql.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
    assert.equal(f.sent.length,0);
  }finally{f.close();}
});
