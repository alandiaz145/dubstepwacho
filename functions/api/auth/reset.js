import {body,hashPassword,ready,response,sameOrigin,throttle,unavailable} from '../_auth.js';
import {hashEmailToken} from '../_email.js';

export async function onRequestPost({request,env}) {
  if(!ready(env))return unavailable();
  if(!sameOrigin(request))return response({error:'Origen no permitido.'},403);
  if(!await throttle(env.DB,request,'reset-password',10))return response({error:'Demasiados intentos.'},429);
  let input;
  try{input=await body(request)}catch{return response({error:'Solicitud inválida.'},400)}
  const token=String(input.token||'');
  const password=input.password;
  if(!/^[a-f0-9]{64}$/.test(token)||typeof password!=='string'||password.length<12||password.length>128)
    return response({error:'Enlace o contraseña inválidos (mínimo 12 caracteres).'},400);
  const row=await env.DB.prepare(`SELECT user_id FROM password_resets
    WHERE token_hash=? AND expires_at>?`).bind(await hashEmailToken(token),Math.floor(Date.now()/1000)).first();
  if(!row)return response({error:'Enlace inválido o vencido.'},400);
  const {hash,salt}=await hashPassword(password);
  try {
    const results=await env.DB.batch([
      // Recheck the still-live token inside the transaction: concurrent resets
      // that observed the same token must not both change the password.
      env.DB.prepare(`UPDATE users SET password_hash=?,password_salt=?
        WHERE id=? AND email_verified_at IS NOT NULL AND EXISTS (
          SELECT 1 FROM password_resets WHERE user_id=? AND token_hash=? AND expires_at>?)`)
        .bind(hash,salt,row.user_id,row.user_id,await hashEmailToken(token),Math.floor(Date.now()/1000)),
      env.DB.prepare(`DELETE FROM sessions WHERE user_id=? AND EXISTS (
        SELECT 1 FROM password_resets WHERE user_id=? AND token_hash=? AND expires_at>?)`)
        .bind(row.user_id,row.user_id,await hashEmailToken(token),Math.floor(Date.now()/1000)),
      env.DB.prepare('DELETE FROM password_resets WHERE user_id=? AND token_hash=?').bind(row.user_id,await hashEmailToken(token))
    ]);
    if(!results[0].meta?.changes)return response({error:'No se pudo cambiar la contraseña.'},409);
    return response({message:'Contraseña actualizada. Ingresá nuevamente.'});
  }catch{return response({error:'No se pudo cambiar la contraseña.'},500)}
}
