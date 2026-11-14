import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScanEvidence} from '../lib/scanEvidence.js';

const fixture=()=>({
  now:2000,maxSignatureAgeMs:1000,
  job:{id:'job-1',attempt:2,trackId:'track-1',objectVersion:'version-2',createdAt:1500,expiresAt:2500,
    objects:{audio:{sha256:'a'.repeat(64),size:1024},cover:{sha256:'b'.repeat(64),size:128}}},
  result:{jobId:'job-1',attempt:2,trackId:'track-1',objectVersion:'version-2',startedAt:1600,finishedAt:1900,
    engine:{name:'SyntheticScanner',version:'1.0',signatureVersion:'20261114',signatureUpdatedAt:1000},
    objects:{audio:{sha256:'a'.repeat(64),size:1024,verdict:'clean'},cover:{sha256:'b'.repeat(64),size:128,verdict:'clean'}}}
});

test('matching evidence for both immutable objects is valid without mutating inputs',()=>{
  const input=fixture(),before=structuredClone(input);
  assert.deepEqual(validateScanEvidence(input),{valid:true,allClean:true});
  assert.deepEqual(input,before);
  assert.deepEqual(Object.keys(validateScanEvidence(input)).sort(),['allClean','valid']);
});

test('each non-clean verdict blocks allClean even when the other object is clean',()=>{
  for(const kind of ['audio','cover'])for(const verdict of ['detected','invalid','error','expired']){
    const input=fixture();input.result.objects[kind].verdict=verdict;
    assert.deepEqual(validateScanEvidence(input),{valid:true,allClean:false});
  }
});

test('results for another job, attempt, track or replaced object version are rejected',()=>{
  for(const field of ['jobId','attempt','trackId','objectVersion']){
    const input=fixture();input.result[field]=field==='attempt'?1:'other';
    assert.deepEqual(validateScanEvidence(input),{valid:false,code:'job_mismatch'});
  }
  for(const kind of ['audio','cover'])for(const field of ['sha256','size']){
    const input=fixture();input.result.objects[kind][field]=field==='sha256'?'c'.repeat(64):999;
    assert.deepEqual(validateScanEvidence(input),{valid:false,code:'object_mismatch'});
  }
});

test('job expiration, future evidence and inconsistent scan chronology fail closed',()=>{
  for(const [now,created,expires,started,finished,code] of [
    [2500,1500,2500,1600,1900,'job_expired'],
    [1499,1500,2500,1600,1900,'job_expired'],
    [2000,1500,2500,1499,1900,'timestamps'],
    [2000,1500,2500,1901,1900,'timestamps'],
    [2000,1500,2500,1600,2001,'timestamps']
  ]){
    const input=fixture();Object.assign(input,{now});Object.assign(input.job,{createdAt:created,expiresAt:expires});
    Object.assign(input.result,{startedAt:started,finishedAt:finished});
    assert.deepEqual(validateScanEvidence(input),{valid:false,code});
  }
  const input=fixture();input.now=2499;input.maxSignatureAgeMs=1499;
  assert.equal(validateScanEvidence(input).valid,true);
});

test('signature age policy is explicit and checked at receipt rather than just scan start',()=>{
  for(const maxSignatureAgeMs of [undefined,0,-1,NaN,Infinity,'1000',1.5]){
    assert.deepEqual(validateScanEvidence({...fixture(),maxSignatureAgeMs}),{valid:false,code:'policy'});
  }
  for(const signatureUpdatedAt of [999,1601,-1,'1000',NaN]){
    const input=fixture();input.result.engine.signatureUpdatedAt=signatureUpdatedAt;
    assert.deepEqual(validateScanEvidence(input),{valid:false,code:'signatures'});
  }
  for(const now of [undefined,NaN,Infinity,-1,'2000',1.5])assert.equal(validateScanEvidence({...fixture(),now}).valid,false);
});

test('missing objects, unknown verdicts, coercible sizes and unrecognized fields are rejected',()=>{
  const mutations=[
    i=>delete i.result.objects.cover,
    i=>i.result.objects.audio.verdict='unknown',
    i=>i.result.objects.audio.size='1024',
    i=>i.result.objects.audio.size=0,
    i=>i.result.objects.audio.sha256='A'.repeat(64),
    i=>i.result.objects.audio.url='https://example.test/private',
    i=>i.result.objects.cover=null,
    i=>i.result.engine.version='',
    i=>i.result.engine.name='scanner\nprivate',
    i=>i.result.engine.signatureVersion='x'.repeat(129),
    i=>i.result.engine.signatureUpdatedAt=null,
    i=>i.result.extra='unexpected',
    i=>i.result.startedAt='1600',
    i=>i.job.objects.audio.size=Number.MAX_SAFE_INTEGER+1,
    i=>i.job.attempt=0,
    i=>i.job.objectVersion='',
    i=>i.job.createdAt=i.job.expiresAt,
    i=>i.job.objects.cover.sha256='invalid'
  ];
  for(const mutate of mutations){const input=fixture();mutate(input);assert.equal(validateScanEvidence(input).valid,false);}
  for(const malformed of [null,[],0,'value',{}]){
    assert.equal(validateScanEvidence({...fixture(),job:malformed}).valid,false);
    assert.equal(validateScanEvidence({...fixture(),result:malformed}).valid,false);
  }
  for(const input of [undefined,null,[],0,'invalid'])assert.deepEqual(validateScanEvidence(input),{valid:false,code:'policy'});
});
