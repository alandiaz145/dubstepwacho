import {body,response} from '../_auth.js';
import {requireMutation,requireUser} from '../_tracks.js';

export async function onRequestPost({request,env}) {
  const originError=requireMutation(request);
  if(originError)return originError;
  const {user,error}=await requireUser(request,env,'admin');
  if(error)return error;
  let input;
  try{input=await body(request)}catch{return response({error:'Solicitud inválida.'},400)}
  const id=String(input.id||'');
  const action=String(input.action||'');
  const reason=String(input.reason||'').trim().slice(0,500);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||!['publish','withdraw'].includes(action))
    return response({error:'Acción inválida.'},400);
  if(action==='withdraw'&&reason.length<3)return response({error:'Explicá el motivo de retirada.'},400);
  try {
    let update;
    let audit;
    if(action==='publish'){
      update=env.DB.prepare(`UPDATE tracks SET status='published',published_at=CURRENT_TIMESTAMP
        WHERE id=? AND status='approved' AND scan_status='clean'`).bind(id);
      audit=env.DB.prepare(`INSERT INTO moderation_events (id,track_id,actor_id,action,reason)
        SELECT ?,?,?,?,? WHERE changes()>0`)
        .bind(crypto.randomUUID(),id,user.id,action,reason);
    }else{
      update=env.DB.prepare(`UPDATE tracks SET status='withdrawn',review_reason=?
        WHERE id=? AND status='published'`).bind(reason,id);
      audit=env.DB.prepare(`INSERT INTO moderation_events (id,track_id,actor_id,action,reason)
        SELECT ?,?,?,?,? WHERE changes()>0`)
        .bind(crypto.randomUUID(),id,user.id,action,reason);
    }
    // D1 batch is transactional: a failed audit insert rolls back the status update.
    const results=await env.DB.batch([update,audit]);
    if(!results[0]?.meta?.changes)return response({error:'No se puede realizar la acción en el estado actual.'},409);
    return response({id,status:action==='publish'?'published':'withdrawn'});
  }catch{return response({error:'No se pudo completar la publicación.'},500)}
}
