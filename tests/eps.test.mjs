import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as list} from '../functions/api/eps/index.js';
import {onRequestGet as detail} from '../functions/api/eps/[slug].js';

test('EP archive exposes only explicitly published volumes',async()=>{
  const seen=[];
  const db={prepare(sql){seen.push(sql);return {all:async()=>({results:[{slug:'vol-1',title:'Vol. 1'}]})}}};
  const result=await list({env:{DB:db}});
  assert.equal((await result.json()).volumes.length,1);
  assert.match(seen[0],/status='published'/);
  const unavailable=await list({env:{}});
  assert.equal(unavailable.status,503);
  assert.deepEqual(await unavailable.json(),{volumes:[]});
});

test('EP detail never exposes unapproved or unscanned tracks',async()=>{
  const statements=[];
  const db={prepare(sql){statements.push(sql);return {bind(){return {first:async()=>({id:'private-id',slug:'vol-1',title:'Vol. 1'}),all:async()=>({results:[{id:'track-id',title:'Track',artist:'Artist'}]})}}}}};
  const result=await detail({env:{DB:db},params:{slug:'vol-1'}});
  const body=await result.json();
  assert.equal(body.volume.id,undefined);
  assert.equal(body.tracks[0].url,'/api/tracks/audio/track-id');
  assert.match(statements[0],/status='published'/);
  assert.match(statements[1],/tracks.status='published' AND tracks.scan_status='clean'/);
  assert.equal((await detail({env:{DB:db},params:{slug:'../../secrets'}})).status,404);
});
