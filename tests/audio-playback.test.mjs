import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioPlayback} from '../src/audioPlayback.js';

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(){
  const calls=[],attempts=[],errors=[];
  const audio={src:'',load(){calls.push(['load',this.src]);},play(){
    calls.push(['play',this.src]);const value=deferred();attempts.push(value);return value.promise;
  },pause(){calls.push(['pause']);}};
  return {calls,attempts,errors,audio,player:createAudioPlayback(audio,error=>errors.push(error))};
}

test('new audio invokes load and play within the initiating action before awaiting',async()=>{
  const f=fixture();
  const result=f.player.start('/api/tracks/audio/test');
  assert.deepEqual(f.calls,[['load','/api/tracks/audio/test'],['play','/api/tracks/audio/test']]);
  f.attempts[0].resolve();assert.equal(await result,true);
});

test('a stale play rejection cannot report an error for a newer successful track',async()=>{
  const f=fixture();
  const first=f.player.start('first'),second=f.player.start('second');
  f.attempts[1].resolve();assert.equal(await second,true);
  f.attempts[0].reject(new Error('old attempt interrupted'));assert.equal(await first,false);
  assert.deepEqual(f.errors,[]);
});

test('pause and disposal invalidate pending attempts and pause the actual element',async()=>{
  for(const action of ['pause','dispose']){
    const f=fixture();const result=f.player.start('first');
    f.player[action]();f.attempts[0].reject(new Error('interrupted'));
    assert.equal(await result,false);assert.deepEqual(f.errors,[]);
    assert.deepEqual(f.calls.at(-1),['pause']);
  }
});

test('a current autoplay denial is reported once and resume retries without reloading',async()=>{
  const f=fixture();const first=f.player.start('first');
  const denied=new DOMException('user gesture required','NotAllowedError');
  f.attempts[0].reject(denied);assert.equal(await first,false);
  assert.deepEqual(f.errors,[denied]);
  const resumed=f.player.resume();
  assert.equal(f.calls.filter(call=>call[0]==='load').length,1);
  f.attempts[1].resolve();assert.equal(await resumed,true);
});

test('synchronous play failures are handled without an unhandled rejection',async()=>{
  const errors=[];const error=new Error('audio unavailable');
  const player=createAudioPlayback({load(){},play(){throw error;}},value=>errors.push(value));
  assert.equal(await player.start('first'),false);assert.deepEqual(errors,[error]);
});
