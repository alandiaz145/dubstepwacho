import test from 'node:test';
import assert from 'node:assert/strict';
import {nextPlayable,playableTracks} from '../src/playerQueue.js';

const tracks=[
  {id:1,demo:true},
  {id:2,url:'https://audio.example/first.mp3'},
  {id:3,demo:true},
  {id:4,url:'https://audio.example/second.mp3'}
];

test('radio skips visual demos without audio',()=>{
  assert.deepEqual(playableTracks(tracks).map(s=>s.id),[2,4]);
  assert.equal(nextPlayable(tracks,2).id,4);
  assert.equal(nextPlayable(tracks,4).id,2);
  assert.equal(nextPlayable(tracks,2,-1).id,4);
});

test('radio is safe when no audio has been published',()=>{
  assert.equal(nextPlayable([{id:1,demo:true}],1),null);
  assert.equal(nextPlayable(tracks,999).id,2);
});

test('radio accepts real catalog URLs and ignores unsafe relative routes',()=>{
  const first='/api/tracks/audio/11111111-1111-4111-8111-111111111111';
  const second='/api/tracks/audio/22222222-2222-4222-8222-222222222222';
  const catalog=[{id:'a',url:first},{id:'bad',url:'/api/admin/tracks'},{id:'b',url:second},
    {id:'unsafe',url:'javascript:alert(1)'}];
  assert.deepEqual(playableTracks(catalog).map(t=>t.id),['a','b']);
  assert.equal(nextPlayable(catalog,'a').id,'b');
  assert.equal(nextPlayable(catalog,'b').id,'a');
});

test('radio skips failed audio without looping forever',()=>{
  assert.equal(nextPlayable(tracks,2,1,new Set([4])).id,2);
  assert.equal(nextPlayable(tracks,2,1,new Set([2,4])),null);
  assert.equal(nextPlayable(tracks,999,1,new Set([2])).id,4);
});
