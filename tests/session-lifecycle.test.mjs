import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {currentUser} from '../functions/api/_auth.js';
import {onRequestPost as logout} from '../functions/api/auth/logout.js';

function fixture(){
  const sql=new DatabaseSync(':memory:');
  for(const file of ['0001_auth.sql','0003_email_verification.sql'])
    sql.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
  sql.prepare(`INSERT INTO users(id,email,display_name,role,password_hash,password_salt,email_verified_at)
    VALUES (?,?,?,?,?,?,?)`).run('artist','artist@example.test','Artist','artist','hash','salt','2026-01-01');
  const DB={prepare(query){return {bind(...args){return {
    first:async()=>sql.prepare(query).get(...args)||null,
    run:async()=>({meta:{changes:sql.prepare(query).run(...args).changes}})
  }}}}};
  const token='a'.repeat(64);
  const second='b'.repeat(64);
  const hash=value=>createHash('sha256').update(value).digest('hex');
  for(const value of [token,second]) sql.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)')
    .run(hash(value),'artist',Math.floor(Date.now()/1000)+3600);
  const request=(cookie=token,origin='https://dubstepwacho.pages.dev')=>new Request('https://dubstepwacho.pages.dev/api/auth/logout',{
    method:'POST',headers:{Cookie:`dw_session=${cookie}`,Origin:origin}
  });
  return {sql,DB,token,second,request};
}

test('SQLite sessions require an unexpired token and verified owner',async()=>{
  const {sql,DB,request}=fixture();
  try{
    assert.equal((await currentUser(request(),DB)).role,'artist');
    for(const token of ['c'.repeat(64),'a'.repeat(63),'a'.repeat(65),'invalid'])
      assert.equal(await currentUser(request(token),DB),null);
    sql.prepare('UPDATE sessions SET expires_at=?').run(Math.floor(Date.now()/1000));
    assert.equal(await currentUser(request(),DB),null);
    sql.prepare('UPDATE sessions SET expires_at=?').run(Math.floor(Date.now()/1000)+3600);
    sql.exec('UPDATE users SET email_verified_at=NULL');
    assert.equal(await currentUser(request(),DB),null);
  }finally{sql.close()}
});

test('SQLite logout denies cross-origin requests and revokes only the current session',async()=>{
  const {sql,DB,second,request}=fixture();
  try{
    const env={DB,AUTH_ENABLED:'true'};
    assert.equal((await logout({env,request:request(undefined,'https://evil.example')})).status,403);
    assert.ok(await currentUser(request(),DB));
    const result=await logout({env,request:request()});
    assert.equal(result.status,200);
    assert.match(result.headers.get('Set-Cookie'),/Max-Age=0/);
    assert.equal(await currentUser(request(),DB),null);
    assert.ok(await currentUser(request(second),DB));
    assert.equal((await logout({env,request:request()})).status,200);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
  }finally{sql.close()}
});
