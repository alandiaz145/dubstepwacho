import {response} from '../_auth.js';
import {requireUser} from '../_tracks.js';

export async function onRequestGet({request,env}) {
  const {user,error}=await requireUser(request,env,'admin');
  if(error) return error;
  const rows=await env.DB.prepare(`SELECT id,title,artist_name AS artist,genre,scan_status AS scanStatus,status,
    audio_bytes AS audioBytes,created_at AS createdAt,review_reason AS reviewReason
    FROM tracks ORDER BY created_at DESC LIMIT 100`).all();
  return response({tracks:rows.results});
}
