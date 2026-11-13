import {response} from '../_auth.js';

export async function onRequestGet({env}) {
  if (!env?.DB?.prepare) return response({tracks:[]},503);
  try {
    const result=await env.DB.prepare(`SELECT id,title,artist_name AS artist,genre,collaborators,
      description,download_allowed AS downloadAllowed,published_at AS publishedAt
      FROM tracks WHERE status='published' AND scan_status='clean'
      ORDER BY published_at DESC LIMIT 100`).all();
    const tracks=(result.results||[]).map(track=>({
      id:track.id,
      title:track.title,
      artist:track.artist,
      genre:track.genre,
      collaborators:track.collaborators,
      description:track.description,
      publishedAt:track.publishedAt,
      url:`/api/tracks/audio/${track.id}`,
      coverUrl:`/api/tracks/cover/${track.id}`,
      downloadAllowed:track.downloadAllowed===1
    }));
    return response({tracks});
  } catch { return response({tracks:[]},503); }
}
