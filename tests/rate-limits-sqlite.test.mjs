import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createSession,throttle} from '../functions/api/_auth.js';

globalThis.crypto ??= webcrypto;

function database(){
  const sql=new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE auth_attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,window_start INTEGER NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX idx_sessions_user ON sessions(user_id);`);
  const DB={
    prepare(query){return {bind(...args){const statement=sql.prepare(query);return {
      first:async()=>statement.get(...args)||null,
      run:async()=>({meta:{changes:statement.run(...args).changes}})
    }}}},
    async batch(statements){
      sql.exec('BEGIN');
      try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}
      catch(error){sql.exec('ROLLBACK');throw error}
    }
  };
  return {sql,DB};
}

const request=ip=>new Request('https://dubstepwacho.pages.dev/api/auth/login',{
  headers:{'CF-Connecting-IP':ip}
});

test('SQLite rate limiter enforces a window per IP and operation',async()=>{
  const {sql,DB}=database();
  try{
    for(let i=0;i<3;i++)assert.equal(await throttle(DB,request('203.0.113.4'),'login',3),true);
    assert.equal(await throttle(DB,request('203.0.113.4'),'login',3),false);
    assert.equal(await throttle(DB,request('203.0.113.5'),'login',3),true);
    assert.equal(await throttle(DB,request('203.0.113.4'),'register',3),true);
    sql.prepare('UPDATE auth_attempts SET window_start=0').run();
    assert.equal(await throttle(DB,request('203.0.113.4'),'login',3),true);
  }finally{sql.close()}
});

test('SQLite account sessions stay within ten after repeated logins',async()=>{
  const {sql,DB}=database();
  try{
    for(let i=0;i<13;i++)await createSession(DB,'artist-1');
    assert.equal(sql.prepare('SELECT count(*) AS n FROM sessions WHERE user_id=?').get('artist-1').n,10);
    sql.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').run('artist-1');
    await createSession(DB,'artist-1');
    assert.equal(sql.prepare('SELECT count(*) AS n FROM sessions WHERE user_id=?').get('artist-1').n,1);
    await createSession(DB,'artist-2');
    assert.equal(sql.prepare('SELECT count(*) AS n FROM sessions WHERE user_id=?').get('artist-2').n,1);
  }finally{sql.close()}
});
