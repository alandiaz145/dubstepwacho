import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hashPassword,verifyPassword,currentUser} from '../functions/api/_auth.js';
import {newEmailToken} from '../functions/api/_email.js';
import {onRequestPost as login} from '../functions/api/auth/login.js';
import {onRequestPost as reset} from '../functions/api/auth/reset.js';

const origin='https://dubstepwacho.pages.dev';
const oldPassword='old-example-passphrase';
const newPassword='new-example-passphrase';
const request=(path,data)=>new Request(`${origin}/api/auth/${path}`,{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)
});
async function fixture(){
  const sql=new DatabaseSync(':memory:');
  for(const name of ['0001_auth.sql','0003_email_verification.sql','0004_password_reset.sql'])
    sql.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
  const credentials=await hashPassword(oldPassword),token=await newEmailToken(1800);
  sql.prepare(`INSERT INTO users(id,email,display_name,role,password_hash,password_salt,email_verified_at)
    VALUES (?,?,?,?,?,?,?)`).run('u1','artist@example.test','Artist','artist',credentials.hash,credentials.salt,'verified');
  sql.prepare('INSERT INTO password_resets VALUES (?,?,?,?)').run('u1',token.tokenHash,token.expiresAt,0);
  let beforeBatch;
  const DB={
    prepare(query){return {bind(...args){return {
      first:async()=>sql.prepare(query).get(...args)||null,
      run:()=>({meta:{changes:sql.prepare(query).run(...args).changes}})
    }}}},
    async batch(statements){
      if(beforeBatch){const callback=beforeBatch;beforeBatch=null;await callback();}
      sql.exec('BEGIN');
      try{const results=statements.map(statement=>statement.run());sql.exec('COMMIT');return results;}
      catch(error){sql.exec('ROLLBACK');throw error;}
    }
  };
  const env={DB,AUTH_ENABLED:'true'};
  return {sql,DB,env,credentials,
    beforeBatch:callback=>{beforeBatch=callback;},
    login:password=>login({env,request:request('login',{email:'artist@example.test',password})}),
    reset:()=>reset({env,request:request('reset',{token:token.token,password:newPassword})})
  };
}

test('a completed password reset prevents an in-flight login with stale credentials from issuing a cookie',async()=>{
  const f=await fixture();
  try{
    f.beforeBatch(async()=>assert.equal((await f.reset()).status,200));
    const result=await f.login(oldPassword);
    assert.equal(result.status,401);
    assert.equal(result.headers.get('Set-Cookie'),null);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
    assert.equal((await f.login(newPassword)).status,200);
  }finally{f.sql.close();}
});

test('a reset after login revokes that session and consumes its token exactly once',async()=>{
  const f=await fixture();
  try{
    const result=await f.login(oldPassword);
    assert.equal(result.status,200);
    const cookie=result.headers.get('Set-Cookie').split(';')[0];
    const sessionRequest=new Request(origin,{headers:{Cookie:cookie}});
    assert.ok(await currentUser(sessionRequest,f.DB));
    assert.equal((await f.reset()).status,200);
    assert.equal(await currentUser(sessionRequest,f.DB),null);
    assert.equal((await f.reset()).status,400);
    assert.equal((await f.login(oldPassword)).status,401);
  }finally{f.sql.close();}
});

test('a failed reset transaction preserves password, sessions and the recovery token',async()=>{
  const f=await fixture();
  try{
    assert.equal((await f.login(oldPassword)).status,200);
    f.sql.exec(`CREATE TRIGGER fail_reset BEFORE DELETE ON password_resets
      BEGIN SELECT RAISE(ABORT,'simulated persistence failure'); END;`);
    assert.equal((await f.reset()).status,500);
    const user=f.sql.prepare('SELECT * FROM users').get();
    assert.equal(await verifyPassword(oldPassword,user.password_salt,user.password_hash),true);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM password_resets').get().n,1);
  }finally{f.sql.close();}
});

test('a login whose owner becomes unverified does not prune existing sessions',async()=>{
  const f=await fixture();
  try{
    for(let i=0;i<10;i++)f.sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)')
      .run(String(i),'u1',Math.floor(Date.now()/1000)+3600);
    f.beforeBatch(async()=>{f.sql.exec('UPDATE users SET email_verified_at=NULL');});
    const result=await f.login(oldPassword);
    assert.equal(result.status,401);
    assert.equal(result.headers.get('Set-Cookie'),null);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,10);
  }finally{f.sql.close();}
});


test('reset revokes sessions even if the token expires between statement preparation timestamps',async()=>{
  const f=await fixture();
  const originalNow=Date.now;
  const originalPrepare=f.DB.prepare;
  try{
    assert.equal((await f.login(oldPassword)).status,200);
    const expiry=f.sql.prepare('SELECT expires_at FROM password_resets').get().expires_at;
    f.DB.prepare=query=>{
      if(query.startsWith('DELETE FROM sessions'))Date.now=()=>expiry*1000;
      return originalPrepare(query);
    };
    assert.equal((await f.reset()).status,200);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
    assert.equal(f.sql.prepare('SELECT count(*) AS n FROM password_resets').get().n,0);
  }finally{Date.now=originalNow;f.sql.close();}
});
