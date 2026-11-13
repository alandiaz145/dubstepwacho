import {response} from '../_auth.js';
import {requireUser} from '../_tracks.js';

export async function onRequestGet({request,env}) {
  const {error}=await requireUser(request,env,'admin');
  if(error)return error;
  try {
    const rows=await env.DB.prepare(`SELECT m.action,m.reason,m.created_at AS createdAt,
      t.title AS trackTitle,t.artist_name AS artistName,u.display_name AS actorName
      FROM moderation_events m
      JOIN tracks t ON t.id=m.track_id
      JOIN users u ON u.id=m.actor_id
      ORDER BY m.created_at DESC,m.id DESC LIMIT 50`).all();
    return response({events:rows.results||[]});
  }catch{return response({error:'No se pudo consultar el historial.'},500)}
}
