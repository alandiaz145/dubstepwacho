import {readBoundedBody,response,throttle} from '../_auth.js';
import {coverType,genres,isMp3,requireMutation,requireUser,sha256} from '../_tracks.js';

const MAX_MP3=10*1024*1024;
const MAX_COVER=3*1024*1024;
const MAX_REQUEST=MAX_MP3+MAX_COVER+65536;

export async function onRequestPost({request,env}) {
  const originError=requireMutation(request);
  if(originError) return originError;
  const {user,error}=await requireUser(request,env,'artist');
  if(error) return error;
  if(env.UPLOADS_ENABLED!=='true') return response({error:'La recepción de música está pendiente de habilitación.'},503);
  if(!env.PRIVATE_MUSIC?.put||!env.PRIVATE_MUSIC?.delete) return response({error:'La recepción segura de música aún no está configurada.'},503);
  const size=Number(request.headers.get('content-length'));
  if(!Number.isSafeInteger(size)||size<1||size>MAX_REQUEST) return response({error:'La carga supera el tamaño permitido.'},413);
  if(!await throttle(env.DB,request,`track-${user.id}`,8)) return response({error:'Alcanzaste el límite temporal de envíos.'},429);
  const submissions=await env.DB.prepare("SELECT COUNT(*) AS count FROM tracks WHERE user_id=? AND created_at>datetime('now','-1 day')").bind(user.id).first();
  if(submissions.count>=5) return response({error:'Límite de cinco canciones por día.'},429);
  let form;
  try{
    const payload=await readBoundedBody(request,MAX_REQUEST);
    form=await new Response(payload,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();
  }catch(error){
    if(error.message==='body_too_large')return response({error:'La carga supera el tamaño permitido.'},413);
    return response({error:'Formulario inválido.'},400);
  }
  const title=String(form.get('title')||'').trim().slice(0,160);
  const artist=String(form.get('artist')||'').trim().slice(0,100);
  const genre=String(form.get('genre')||'');
  const collaborators=String(form.get('collaborators')||'').trim().slice(0,300);
  const description=String(form.get('description')||'').trim().slice(0,2000);
  const download=form.get('downloadAllowed')==='true'?1:0;
  const rights=form.get('rights')==='true';
  const mp3=form.get('mp3'),cover=form.get('cover');
  if(title.length<1||artist.length<2||!genres.has(genre)||!rights||!(mp3 instanceof File)||!(cover instanceof File))
    return response({error:'Completá título, artista, género, portada y autorización de derechos.'},400);
  if(mp3.size>MAX_MP3||mp3.size<1024||cover.size>MAX_COVER||cover.size<100)
    return response({error:'MP3 máximo 10 MB y portada máximo 3 MB.'},413);
  const audioBytes=new Uint8Array(await mp3.arrayBuffer()),coverBytes=new Uint8Array(await cover.arrayBuffer());
  const imageType=coverType(coverBytes);
  if(!isMp3(audioBytes)||!imageType) return response({error:'El MP3 o la portada no tienen un formato válido.'},415);
  const id=crypto.randomUUID(),audioKey=`quarantine/${id}/audio.mp3`,coverKey=`quarantine/${id}/cover.${imageType==='image/png'?'png':'jpg'}`;
  try{
    await env.PRIVATE_MUSIC.put(audioKey,audioBytes,{httpMetadata:{contentType:'audio/mpeg'}});
    await env.PRIVATE_MUSIC.put(coverKey,coverBytes,{httpMetadata:{contentType:imageType}});
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO tracks (id,user_id,title,artist_name,collaborators,genre,description,download_allowed,audio_key,cover_key,audio_bytes,audio_sha256)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,user.id,title,artist,collaborators,genre,description,download,audioKey,coverKey,mp3.size,await sha256(audioBytes)),
      env.DB.prepare('INSERT INTO moderation_events (id,track_id,actor_id,action) VALUES (?,?,?,?)')
        .bind(crypto.randomUUID(),id,user.id,'submitted')
    ]);
  }catch{
    await Promise.allSettled([audioKey,coverKey].map(key=>Promise.resolve().then(()=>env.PRIVATE_MUSIC.delete(key))));
    return response({error:'No se pudo guardar el envío. Intentá nuevamente.'},500);
  }
  return response({id,status:'pending_analysis',message:'Recibido en cuarentena. No se publicará antes del análisis y la revisión.'},202);
}
