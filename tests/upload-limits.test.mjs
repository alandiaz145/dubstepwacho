import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as submit} from '../functions/api/tracks/submit.js';

const origin='https://dubstepwacho.pages.dev';
function environment(){
  return {AUTH_ENABLED:'true',UPLOADS_ENABLED:'true',
    PRIVATE_MUSIC:{put(){throw Error('R2 must not be reached');},async delete(){}},
    DB:{prepare(sql){return {bind(){return {
      async first(){
        if(sql.includes('FROM sessions'))return {id:'artist-1',role:'artist'};
        return {count:1};
      },async run(){return {meta:{changes:1}};}
    }}}}}
  };
}
function request(body,headers={}){
  return new Request(`${origin}/api/tracks/submit`,{method:'POST',duplex:'half',body,
    headers:{Origin:origin,Cookie:`dw_session=${'a'.repeat(64)}`,'Content-Length':'100',...headers}});
}

test('private upload cancels an oversized stream despite an understated Content-Length',async()=>{
  let cancelled=false,reads=0;
  const stream=new ReadableStream({
    pull(controller){reads++;controller.enqueue(new Uint8Array(1024*1024));},
    cancel(){cancelled=true;}
  },{highWaterMark:0});
  const result=await submit({env:environment(),request:request(stream,{'Content-Type':'multipart/form-data; boundary=test'})});
  assert.equal(result.status,413);
  assert.equal(cancelled,true);
  assert.equal(reads,14);
});

test('bounded upload still parses multipart and rejects invalid fields or broken encoding',async()=>{
  const form=new FormData();
  form.set('title','Example');
  const encoded=new Request(`${origin}/api/tracks/submit`,{method:'POST',body:form});
  const result=await submit({env:environment(),request:request(await encoded.arrayBuffer(),{'Content-Type':encoded.headers.get('Content-Type')})});
  assert.equal(result.status,400);
  assert.match((await result.json()).error,/Completá/);
  const broken=await submit({env:environment(),request:request('broken',{'Content-Type':'multipart/form-data; boundary=test'})});
  assert.equal(broken.status,400);
});

test('disabled uploads reject the request without reading the stream',async()=>{
  let reads=0;
  const stream=new ReadableStream({pull(){reads++;}},{highWaterMark:0});
  const env=environment();env.UPLOADS_ENABLED='false';
  const result=await submit({env,request:request(stream)});
  assert.equal(result.status,503);
  assert.equal(reads,0);
});

async function validUpload(){
  const form=new FormData();
  for(const [key,value] of Object.entries({title:'Private test',artist:'Test Artist',genre:'Dubstep',rights:'true'})) form.set(key,value);
  const audio=new Uint8Array(1024);audio.set([73,68,51,4]);
  const cover=new Uint8Array(100);cover.set([137,80,78,71,13,10,26,10]);
  form.set('mp3',new File([audio],'untrusted.mp3'));
  form.set('cover',new File([cover],'untrusted.png'));
  const encoded=new Request(`${origin}/api/tracks/submit`,{method:'POST',body:form});
  const payload=await encoded.arrayBuffer();
  return request(payload,{'Content-Type':encoded.headers.get('Content-Type'),'Content-Length':String(payload.byteLength)});
}

test('bounded multipart upload stores private objects and audits pending analysis only',async()=>{
  const env=environment(),stored=[],batches=[];
  env.PRIVATE_MUSIC.put=async(key,value)=>{stored.push({key,size:value.length});};
  env.DB.batch=async statements=>{batches.push(statements);return [{meta:{changes:1}},{meta:{changes:1}}];};
  const result=await submit({env,request:await validUpload()});
  assert.equal(result.status,202);
  const data=await result.json();
  assert.equal(data.status,'pending_analysis');
  assert.deepEqual(stored,[{key:`quarantine/${data.id}/audio.mp3`,size:1024},{key:`quarantine/${data.id}/cover.png`,size:100}]);
  assert.equal(batches.length,1);
  assert.equal(batches[0].length,2);
  assert.doesNotMatch(JSON.stringify(data),/quarantine|untrusted/);
});

test('failed quarantine transaction attempts both object deletions even if one throws',async()=>{
  const env=environment(),removed=[];
  env.PRIVATE_MUSIC.put=async()=>{};
  env.DB.batch=async()=>{throw Error('database unavailable');};
  env.PRIVATE_MUSIC.delete=key=>{removed.push(key);if(key.endsWith('.mp3'))throw Error('storage unavailable');};
  const result=await submit({env,request:await validUpload()});
  assert.equal(result.status,500);
  assert.equal(removed.length,2);
  assert.match(removed[0],/audio\.mp3$/);
  assert.match(removed[1],/cover\.png$/);
});
