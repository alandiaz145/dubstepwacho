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
