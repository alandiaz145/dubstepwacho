import {response} from '../_auth.js';

export async function onRequestGet({env}) {
  if(!env?.DB?.prepare)return response({volumes:[]});
  try {
    const rows=await env.DB.prepare(`SELECT slug,title,volume_number AS number,year,description,released_at AS releasedAt
      FROM ep_volumes WHERE status='published' ORDER BY year DESC,volume_number DESC LIMIT 50`).all();
    return response({volumes:rows.results||[]});
  }catch{return response({volumes:[]},503)}
}
