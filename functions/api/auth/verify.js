import {body,ready,response,sameOrigin,throttle,unavailable} from '../_auth.js';
import {hashEmailToken} from '../_email.js';

export async function onRequestPost({request,env}) {
  if(!ready(env))return unavailable();
  if(!sameOrigin(request))return response({error:'Origen no permitido.'},403);
  if(!await throttle(env.DB,request,'verify-email',10))return response({error:'Demasiados intentos.'},429);
  let input;
  try{input=await body(request)}catch{return response({error:'Solicitud inválida.'},400)}
  const token=String(input.token||'');
  if(!/^[a-f0-9]{64}$/.test(token))return response({error:'Enlace inválido o vencido.'},400);
  const row=await env.DB.prepare(`SELECT user_id FROM email_verifications
    WHERE token_hash=? AND expires_at>?`).bind(await hashEmailToken(token),Math.floor(Date.now()/1000)).first();
  if(!row)return response({error:'Enlace inválido o vencido.'},400);
  try {
    const changes=await env.DB.batch([
      env.DB.prepare('UPDATE users SET email_verified_at=CURRENT_TIMESTAMP WHERE id=? AND email_verified_at IS NULL').bind(row.user_id),
      env.DB.prepare('DELETE FROM email_verifications WHERE user_id=?').bind(row.user_id)
    ]);
    if(!changes[0].meta?.changes)return response({error:'Enlace ya utilizado.'},409);
    return response({message:'Correo confirmado. Ya podés ingresar.'});
  }catch{return response({error:'No se pudo confirmar el correo.'},500)}
}
