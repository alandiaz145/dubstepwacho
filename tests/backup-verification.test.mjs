import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyD1Backup} from '../scripts/verify-d1-backup.mjs';

const schema=['0001_auth.sql','0002_tracks.sql'].map(name=>readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8')).join('\n');
const dump=`PRAGMA foreign_keys=OFF; BEGIN TRANSACTION; ${schema}
INSERT INTO users(id,email,display_name,role,password_hash,password_salt) VALUES ('u','private@example.test','Private Person','artist','private-hash','private-salt');
COMMIT;`;
const counts={users:1,sessions:0,auth_attempts:0,artist_profiles:0,tracks:0,moderation_events:0};

test('a D1-style export restores locally and reports only metadata, hash and counts',()=>{
  const report=verifyD1Backup(dump,counts);
  assert.equal(report.scope,'local-restore-only');
  assert.equal(report.sha256,createHash('sha256').update(dump).digest('hex'));
  assert.equal(report.integrity,'ok');assert.equal(report.foreignKeys,'ok');
  assert.deepEqual(report.counts,counts);assert.equal(report.comparedExpectedCounts,true);
  assert.doesNotMatch(JSON.stringify(report),/private@example|Private Person|private-hash|private-salt/);
});

test('incomplete, inconsistent and count-mismatched exports are rejected',()=>{
  assert.throws(()=>verifyD1Backup('CREATE TABLE users(id TEXT);'),/esquema/);
  assert.throws(()=>verifyD1Backup(dump.replace('COMMIT;','')),/incompleta/);
  assert.throws(()=>verifyD1Backup(dump.replace('COMMIT;',"INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ('h','missing',0); COMMIT;")),/referencias/);
  assert.throws(()=>verifyD1Backup(dump,{...counts,users:2}),/recuento/);
  assert.throws(()=>verifyD1Backup(dump,null),/Recuentos/);
  assert.throws(()=>verifyD1Backup(Buffer.from([0xff])),/UTF-8/);
});

test('restore cannot attach files, load extensions, alter writable_schema or install triggers',()=>{
  const folder=mkdtempSync(join(tmpdir(),'dw-backup-test-'));
  try{
    const target=join(folder,'forbidden.sqlite');
    for(const statement of [`ATTACH DATABASE '${target}' AS outside;`,"SELECT load_extension('forbidden');",'PRAGMA writable_schema=ON;','CREATE TEMP TABLE sessions(id TEXT);',
      "CREATE TRIGGER unexpected AFTER INSERT ON users BEGIN DELETE FROM sessions; END;"])
      assert.throws(()=>verifyD1Backup(schema+statement),/no permitidas/);
    assert.equal(existsSync(target),false);
  }finally{rmSync(folder,{recursive:true,force:true});}
});

test('the offline CLI verifies a file without logging account data',()=>{
  const folder=mkdtempSync(join(tmpdir(),'dw-backup-cli-'));
  try{
    const sql=join(folder,'export.sql'),expected=join(folder,'counts.json');
    writeFileSync(sql,dump,{mode:0o600});writeFileSync(expected,JSON.stringify(counts),{mode:0o600});
    const output=execFileSync(process.execPath,['scripts/verify-d1-backup.mjs',sql,expected],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
    assert.equal(JSON.parse(output).comparedExpectedCounts,true);
    assert.doesNotMatch(output,/private@example|Private Person|private-hash|private-salt/);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
