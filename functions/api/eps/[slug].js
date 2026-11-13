import {response} from '../_auth.js';

export async function onRequestGet({env,params}) {
  const slug=String(params?.slug||'');
  if(!/^[a-z0-9-]{2,80}$/.test(slug))return response({error:'Volumen no encontrado.'},404);
  if(!env?.DB?.prepare)return response({error:'No disponible.'},503);
  try {
    const volume=await env.DB.prepare(`SELECT id,slug,title,volume_number AS number,year,description,released_at AS releasedAt
      FROM ep_volumes WHERE slug=? AND status='published'`).bind(slug).first();
    if(!volume)return response({error:'Volumen no encontrado.'},404);
    const tracks=await env.DB.prepare(`SELECT tracks.id,tracks.title,tracks.artist_name AS artist,tracks.genre,
      tracks.collaborators,ep_tracks.track_order AS position
      FROM ep_tracks JOIN tracks ON ep_tracks.track_id=tracks.id
      WHERE ep_tracks.volume_id=? AND tracks.status='published' AND tracks.scan_status='clean'
      ORDER BY ep_tracks.track_order`).bind(volume.id).all();
    const {id,...publicVolume}=volume;
    return response({volume:publicVolume,tracks:(tracks.results||[]).map(t=>({...t,
      url:`/api/tracks/audio/${t.id}`,coverUrl:`/api/tracks/cover/${t.id}`
    }))});
  }catch{return response({error:'No disponible.'},503)}
}
