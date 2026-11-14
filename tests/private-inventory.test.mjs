import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePrivateInventory} from '../lib/privateInventory.js';
const empty={referencedPresent:0,missingObjects:0,sizeMismatches:0,unreferencedWithinGrace:0,unreferencedNeedsReview:0,unreferencedUnknownAge:0};
const snapshot=()=>({now:10000,gracePeriodMs:1000,references:[],objects:[]});

test('complete private snapshots distinguish missing, mismatched and present objects without disclosing keys',()=>{
  const input={...snapshot(),references:[{key:'private/present',size:10},{key:'private/missing',size:20},{key:'private/changed',size:30}],
    objects:[{key:'private/present',size:10,uploadedAt:100},{key:'private/changed',size:31,uploadedAt:100}]};
  const before=structuredClone(input),report=summarizePrivateInventory(input);
  assert.deepEqual(report,{...empty,referencedPresent:1,missingObjects:1,sizeMismatches:1});
  assert.deepEqual(input,before);assert.equal(JSON.stringify(report).includes('private/'),false);
});

test('recent unreferenced objects are held for concurrent uploads and old objects only need review',()=>{
  const input={...snapshot(),objects:[{key:'upload-in-progress',size:10,uploadedAt:9001},{key:'at-boundary',size:10,uploadedAt:9000},{key:'older',size:10,uploadedAt:0}]};
  assert.deepEqual(summarizePrivateInventory(input),{...empty,unreferencedWithinGrace:1,unreferencedNeedsReview:2});
  input.references=[{key:'upload-in-progress',size:10}];
  assert.deepEqual(summarizePrivateInventory(input),{...empty,referencedPresent:1,unreferencedNeedsReview:2});
});

test('unknown or future timestamps cannot qualify an unreferenced object for age review',()=>{
  assert.deepEqual(summarizePrivateInventory({...snapshot(),objects:[{key:'unknown',size:10,uploadedAt:null},{key:'future',size:10,uploadedAt:10001}]}),{...empty,unreferencedUnknownAge:2});
  assert.deepEqual(summarizePrivateInventory(snapshot()),empty);
});

test('ambiguous snapshots and missing clock or grace policies fail without private error details',()=>{
  const bad=[undefined,null,{}, {...snapshot(),gracePeriodMs:0},{...snapshot(),now:NaN},
    {...snapshot(),references:null},
    {...snapshot(),references:[{key:'sensitive-key',size:1},{key:'sensitive-key',size:1}]},
    {...snapshot(),objects:[{key:'sensitive-key',size:1,uploadedAt:1},{key:'sensitive-key',size:1,uploadedAt:1}]},
    {...snapshot(),objects:[{key:'sensitive-key',size:1}]},
    {...snapshot(),objects:[{key:'sensitive-key',size:'1',uploadedAt:1}]},
    {...snapshot(),references:[{key:'sensitive-key\n',size:1}]},
    {...snapshot(),references:[{key:'sensitive-key',size:0}]},
    {...snapshot(),objects:[{key:'sensitive-key',size:1,uploadedAt:-1}]}];
  for(const input of bad)assert.throws(()=>summarizePrivateInventory(input),{message:'Invalid private inventory snapshot or policy.'});
});
