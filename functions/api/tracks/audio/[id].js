import {mediaError} from '../../_media.js';

const validId=id=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||'');

export function parseByteRange(header,size) {
  if (!header) return null;
  if (!/^bytes=\d*-\d*$/.test(header)) return false;
  const [startText,endText]=header.slice(6).split('-');
  if(!startText&&!endText)return false;
  let start,end;
  if(!startText){
    const suffix=Number(endText);
    if(!Number.isSafeInteger(suffix)||suffix<1)return false;
    start=Math.max(0,size-suffix);end=size-1;
  }else{
    start=Number(startText);end=endText?Number(endText):size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return false;
    end=Math.min(end,size-1);
  }
  return {offset:start,length:end-start+1,start,end};
}

async function serveAudio({request,env,params},headOnly=false) {
  try{
    if(!validId(params?.id))return mediaError('Not found',404,headOnly);
    if(!env?.DB?.prepare||!env?.PRIVATE_MUSIC?.get||!env?.PRIVATE_MUSIC?.head)return mediaError('Unavailable',503,headOnly);
    const track=await env.DB.prepare(`SELECT audio_key FROM tracks WHERE id=?
      AND status='published' AND scan_status='clean'`).bind(params.id).first();
    if(!track?.audio_key)return mediaError('Not found',404,headOnly);
    const head=await env.PRIVATE_MUSIC.head(track.audio_key);
    if(!head||!Number.isSafeInteger(head.size)||head.size<1)return mediaError('Not found',404,headOnly);
    const range=parseByteRange(request.headers.get('Range'),head.size);
    const headers=new Headers({
      'Content-Type':'audio/mpeg',
      'Accept-Ranges':'bytes',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    });
    if(range===false){headers.set('Content-Range',`bytes */${head.size}`);return new Response(null,{status:416,headers});}
    headers.set('Content-Length',String(range?range.length:head.size));
    if(range)headers.set('Content-Range',`bytes ${range.start}-${range.end}/${head.size}`);
    if(headOnly)return new Response(null,{status:range?206:200,headers});
    const object=await env.PRIVATE_MUSIC.get(track.audio_key,range?{range:{offset:range.offset,length:range.length}}:{});
    if(!object?.body)return mediaError('Not found',404,headOnly);
    return new Response(object.body,{status:range?206:200,headers});
  }catch{return mediaError('Unavailable',503,headOnly)}
}

export const onRequestGet=context=>serveAudio(context);
export const onRequestHead=context=>serveAudio(context,true);
