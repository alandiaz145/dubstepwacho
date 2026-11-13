import {body,response} from '../_auth.js';
import {requireMutation,requireUser} from '../_tracks.js';

export async function onRequestPost({request,env}) {
  const originError=requireMutation(request);
  if(originError) return originError;
  const {user,error}=await requireUser(request,env,'admin');
  if(error) return error;
  let input;
  try{input=await body(request)}catch{return response({error:'Solicitud inválida.'},400)}
  const id=String(input.id||''),action=String(input.action||''),reason=String(input.reason||'').trim().slice(0,500);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||!['approve','reject','request_changes'].includes(action)) return response({error:'Acción inválida.'},400);
  if(action!=='approve'&&reason.length<3) return response({error:'Indicá el motivo de la decisión.'},400);
  const track=await env.DB.prepare('SELECT status,scan_status FROM tracks WHERE id=?').bind(id).first();
  if(!track) return response({error:'Canción no encontrada.'},404);
  if(action==='approve'&&(track.scan_status!=='clean'||track.status!=='pending_review'))
    return response({error:'No se puede aprobar: falta análisis limpio y revisión pendiente.'},409);
  if(!['pending_analysis','pending_review'].includes(track.status)) return response({error:'El envío ya fue revisado.'},409);
  const status=action==='approve'?'approved':'rejected';
  try {
    const guard=action==='approve'?"status='pending_review' AND scan_status='clean'":"status IN ('pending_analysis','pending_review')";
    const results=await env.DB.batch([
      env.DB.prepare(`UPDATE tracks SET status=?,review_reason=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP
        WHERE id=? AND ${guard}`).bind(status,reason||null,user.id,id),
      env.DB.prepare(`INSERT INTO moderation_events (id,track_id,actor_id,action,reason)
        SELECT ?,?,?,?,? WHERE changes()>0`).bind(crypto.randomUUID(),id,user.id,action,reason)
    ]);
    if(!results[0]?.meta?.changes)return response({error:'La canción cambió de estado. Actualizá la lista.'},409);
    return response({id,status});
  }catch{return response({error:'No se pudo guardar la decisión.'},500)}
}
