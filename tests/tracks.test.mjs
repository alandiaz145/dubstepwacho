import test from 'node:test';
import assert from 'node:assert/strict';
import {isMp3,coverType,genres} from '../functions/api/_tracks.js';
import {onRequestPost as submit} from '../functions/api/tracks/submit.js';
import {onRequestPost as review} from '../functions/api/admin/review.js';

test('audio and image signatures are checked, not just filenames',()=>{
  assert.equal(isMp3(new Uint8Array([73,68,51,4,0,0])),true);
  assert.equal(isMp3(new Uint8Array([0xff,0xfb,0x90,0x64])),true);
  assert.equal(isMp3(new Uint8Array([0,0,0,0])),false);
  assert.equal(coverType(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
  assert.equal(coverType(new Uint8Array([255,216,255,224])),'image/jpeg');
  assert.equal(coverType(new Uint8Array([0,0,0,0])),null);
  assert.equal(genres.has('Tearout'),true);
});

test('upload and admin decisions are unavailable without backing D1',async()=>{
  const url='https://dubstepwacho.pages.dev';
  const upload=await submit({request:new Request(`${url}/api/tracks/submit`,{method:'POST',headers:{Origin:url}}),env:{}});
  const decision=await review({request:new Request(`${url}/api/admin/review`,{method:'POST',headers:{Origin:url}}),env:{}});
  assert.equal(upload.status,503);
  assert.equal(decision.status,503);
});
