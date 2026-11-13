import test from 'node:test';
import assert from 'node:assert/strict';
import {parseByteRange,onRequestGet as audioGet} from '../functions/api/tracks/audio/[id].js';
import {onRequestGet as coverGet} from '../functions/api/tracks/cover/[id].js';
import {onRequestGet as listGet} from '../functions/api/tracks/index.js';

const ID='12345678-1234-1234-1234-1234567890ab';
const bytes=new Uint8Array([1,2,3,4,5,6,7,8,9,10]);
const db=track=>({prepare(sql){
  if(!sql.includes("status='published' AND scan_status='clean'"))throw Error('missing-publication-gate');
  return {bind(){return {first:async()=>track}},all:async()=>({results:track?[track]:[]})};
}});
const store={
  head:async()=>({size:bytes.length}),
  get:async(key,options)=>{
    if(key!=='quarantine/sample/audio.mp3'&&key!=='quarantine/sample/cover.jpg')throw Error('unexpected-key');
    const b=options?.range?bytes.slice(options.range.offset,options.range.offset+options.range.length):bytes;
    return {body:new Blob([b]).stream()};
  }
};
const audio=(range,track={audio_key:'quarantine/sample/audio.mp3'})=>audioGet({request:new Request(`https://dubstepwacho.pages.dev/api/tracks/audio/${ID}`,range?{headers:{Range:range}}:{}),env:{DB:db(track),PRIVATE_MUSIC:store},params:{id:ID}});

test('byte ranges support iPhone seeking and reject invalid ranges',()=>{
  assert.deepEqual(parseByteRange('bytes=2-5',10),{offset:2,length:4,start:2,end:5});
  assert.deepEqual(parseByteRange('bytes=8-',10),{offset:8,length:2,start:8,end:9});
  assert.deepEqual(parseByteRange('bytes=-3',10),{offset:7,length:3,start:7,end:9});
  assert.equal(parseByteRange('bytes=10-',10),false);
  assert.equal(parseByteRange('bytes=0-2,4-6',10),false);
});
test('only reviewed and published audio is streamable with correct 206 headers',async()=>{
  const res=await audio('bytes=2-5');
  assert.equal(res.status,206);
  assert.equal(res.headers.get('Content-Range'),'bytes 2-5/10');
  assert.equal(res.headers.get('Accept-Ranges'),'bytes');
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())],[3,4,5,6]);
  const missing=await audio(null,null);
  assert.equal(missing.status,404);
  const unsatisfiable=await audio('bytes=999-');
  assert.equal(unsatisfiable.status,416);
  assert.equal(unsatisfiable.headers.get('Content-Range'),'bytes */10');
});
test('covers and catalog also require published clean records',async()=>{
  assert.equal((await coverGet({env:{DB:db(null),PRIVATE_MUSIC:store},params:{id:ID}})).status,404);
  const cover=await coverGet({env:{DB:db({cover_key:'quarantine/sample/cover.jpg'}),PRIVATE_MUSIC:store},params:{id:ID}});
  assert.equal(cover.status,200);
  const index=await listGet({env:{DB:db({id:ID,title:'Track',artist:'Artist',downloadAllowed:0})}});
  const data=await index.json();
  assert.equal(data.tracks[0].url,`/api/tracks/audio/${ID}`);
  assert.equal(data.tracks[0].downloadAllowed,false);
});
