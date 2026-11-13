const validId=id=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||'');

export async function onRequestGet({env,params}) {
  if(!validId(params?.id))return new Response('Not found',{status:404});
  if(!env?.DB?.prepare||!env?.PRIVATE_MUSIC?.get)return new Response('Unavailable',{status:503});
  const track=await env.DB.prepare(`SELECT cover_key FROM tracks WHERE id=?
    AND status='published' AND scan_status='clean'`).bind(params.id).first();
  if(!track)return new Response('Not found',{status:404});
  const cover=await env.PRIVATE_MUSIC.get(track.cover_key);
  if(!cover?.body)return new Response('Not found',{status:404});
  return new Response(cover.body,{headers:{
    'Content-Type':track.cover_key.endsWith('.png')?'image/png':'image/jpeg',
    'Cache-Control':'public, max-age=300',
    'X-Content-Type-Options':'nosniff'
  }});
}
