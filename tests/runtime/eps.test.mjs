import test from 'node:test';
import assert from 'node:assert/strict';
import {origin,startRuntime} from './helpers.mjs';

test('EP reads on local D1 expose only published volumes and published clean tracks',{timeout:60000},async()=>{
  const f=await startRuntime();
  try{
    await f.db.prepare(`INSERT INTO users(id,email,display_name,role,password_hash,password_salt)
      VALUES (?,?,?,?,?,?)`).bind('artist','artist@example.test','Artist','artist','test-only','test-only').run();
    const states=['draft','applications_open','selection','published','archived'];
    for(const [index,status] of states.entries())await f.db.prepare(`INSERT INTO ep_volumes(id,slug,title,volume_number,year,status,opens_at,closes_at)
      VALUES (?,?,?,?,?,?,?,?)`).bind(status,`vol-${index+1}`,`Synthetic Volume ${index+1}`,index+1,2026,status,'private-open-date','private-close-date').run();
    const variants=[['pending_analysis','pending'],['pending_review','clean'],['approved','clean'],['rejected','clean'],['withdrawn','clean'],['published','infected'],['published','clean']];
    let cleanId;
    for(const [position,[status,scan]] of variants.entries()){
      const id=crypto.randomUUID();if(status==='published'&&scan==='clean')cleanId=id;
      await f.db.prepare(`INSERT INTO tracks(id,user_id,title,artist_name,genre,audio_key,cover_key,audio_bytes,audio_sha256,status,scan_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id,'artist',`Synthetic Track ${position}`,'Artist','Dubstep',`private/${id}/audio`, `private/${id}/cover`,1024,'test-only',status,scan).run();
      for(const volume of states)await f.db.prepare('INSERT INTO ep_tracks(volume_id,track_id,track_order) VALUES (?,?,?)').bind(volume,id,position+1).run();
    }
    const index=await f.mf.dispatchFetch(`${origin}/api/eps/`);
    assert.equal(index.status,200);
    const listing=await index.json();
    assert.deepEqual(listing.volumes.map(volume=>volume.slug),['vol-4']);
    assert.doesNotMatch(JSON.stringify(listing),/private-open-date|private-close-date/);
    for(const number of [1,2,3,5])assert.equal((await f.mf.dispatchFetch(`${origin}/api/eps/vol-${number}`)).status,404);
    const publicVolume=await f.mf.dispatchFetch(`${origin}/api/eps/vol-4`);
    assert.equal(publicVolume.status,200);
    const data=await publicVolume.json();
    assert.equal(data.volume.id,undefined);
    assert.deepEqual(data.tracks.map(track=>track.id),[cleanId]);
    assert.equal(data.tracks[0].url,`/api/tracks/audio/${cleanId}`);
    assert.doesNotMatch(JSON.stringify(data),/private\/|audio_key|cover_key|private-open-date|private-close-date/);
    await f.db.prepare("UPDATE tracks SET status='withdrawn' WHERE id=?").bind(cleanId).run();
    const afterWithdrawal=await f.mf.dispatchFetch(`${origin}/api/eps/vol-4`);
    assert.deepEqual((await afterWithdrawal.json()).tracks,[]);
    await f.db.prepare("UPDATE ep_volumes SET status='archived' WHERE id='published'").run();
    assert.equal((await f.mf.dispatchFetch(`${origin}/api/eps/vol-4`)).status,404);
    assert.deepEqual((await (await f.mf.dispatchFetch(`${origin}/api/eps/`)).json()).volumes,[]);
    assert.equal(f.sent.length,0);
  }finally{await f.close();}
});
