import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {onRequestPost as review} from '../functions/api/admin/review.js';
import {onRequestPost as publish} from '../functions/api/admin/publication.js';

globalThis.crypto ??= webcrypto;
const id='11111111-1111-4111-8111-111111111111';
const origin='https://dubstepwacho.pages.dev';
const token='a'.repeat(64);
const tokenHash=createHash('sha256').update(token).digest('hex');

function database(){
  const sql=new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT,email_verified_at TEXT);
    CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);
    CREATE TABLE tracks(id TEXT PRIMARY KEY,status TEXT,scan_status TEXT,review_reason TEXT,reviewed_by TEXT,reviewed_at TEXT,published_at TEXT);
    CREATE TABLE moderation_events(id TEXT,track_id TEXT,actor_id TEXT,action TEXT,reason TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
  sql.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run('admin-1','admin@example.test','Admin','admin','2026-11-13');
  sql.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash,'admin-1',Math.floor(Date.now()/1000)+3600);
  sql.prepare('INSERT INTO tracks (id,status,scan_status) VALUES (?,?,?)').run(id,'pending_review','clean');
  const wrap=sqlText=>({bind(...args){
    const statement=sql.prepare(sqlText);
    return {
      first:async()=>statement.get(...args)||null,
      run:async()=>({meta:{changes:statement.run(...args).changes}}),
      all:async()=>({results:statement.all(...args)})
    };
  }});
  return {sql,DB:{prepare:wrap,async batch(statements){
    sql.exec('BEGIN');
    try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}
    catch(error){sql.exec('ROLLBACK');throw error}
  }}};
}
const request=(path,action,reason='')=>new Request(`${origin}${path}`,{method:'POST',
  headers:{Origin:origin,Cookie:`dw_session=${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({id,action,reason})});
const env=DB=>({DB,AUTH_ENABLED:'true'});

test('SQLite commits review and publication audits once, rejecting stale transitions',async()=>{
  const {sql,DB}=database();
  try{
    assert.equal((await review({request:request('/api/admin/review','approve'),env:env(DB)})).status,200);
    assert.equal((await publish({request:request('/api/admin/publication','publish'),env:env(DB)})).status,200);
    assert.equal((await review({request:request('/api/admin/review','reject','Llegó tarde'),env:env(DB)})).status,409);
    assert.equal((await publish({request:request('/api/admin/publication','publish'),env:env(DB)})).status,409);
    assert.equal(sql.prepare('SELECT status FROM tracks WHERE id=?').get(id).status,'published');
    assert.equal(sql.prepare('SELECT count(*) AS count FROM moderation_events').get().count,2);
  }finally{sql.close()}
});
test('a failing audit insert rolls back the track status',async()=>{
  const {sql,DB}=database();
  try{
    sql.exec(`CREATE TRIGGER fail_moderation_event BEFORE INSERT ON moderation_events
      BEGIN SELECT RAISE(ABORT,'audit failed'); END;`);
    const result=await review({request:request('/api/admin/review','approve'),env:env(DB)});
    assert.equal(result.status,500);
    assert.equal(sql.prepare('SELECT status FROM tracks WHERE id=?').get(id).status,'pending_review');
    assert.equal(sql.prepare('SELECT count(*) AS count FROM moderation_events').get().count,0);
  }finally{sql.close()}
});
