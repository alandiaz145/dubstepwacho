import {body,ready,response,sameOrigin,throttle,unavailable,validEmail,verifyTurnstile} from '../_auth.js';
import {emailDeliveryReady,newEmailToken,sendPasswordResetEmail} from '../_email.js';

export async function onRequestPost({request,env}) {
  if(!ready(env))return unavailable();
  if(!emailDeliveryReady(env))return response({error:'La recuperación de acceso no está disponible.'},503);
  if(!sameOrigin(request))return response({error:'Origen no permitido.'},403);
  if(!await throttle(env.DB,request,'forgot-password',4))return response({error:'Demasiados intentos.'},429);
  let input;
  try{input=await body(request)}catch{return response({error:'Solicitud inválida.'},400)}
  if(!await verifyTurnstile(env,input.turnstileToken,request))return response({error:'Completá la verificación de seguridad.'},403);
  const email=String(input.email||'').trim().toLowerCase();
  if(!validEmail(email))return response({error:'Correo inválido.'},400);
  const generic=()=>response({message:'Si existe una cuenta verificada, enviaremos instrucciones para recuperar el acceso.'});
  const user=await env.DB.prepare(`SELECT users.id,users.display_name,password_resets.sent_at
    FROM users LEFT JOIN password_resets ON users.id=password_resets.user_id
    WHERE users.email=? AND users.email_verified_at IS NOT NULL`).bind(email).first();
  if(!user||user.sent_at&&Number(user.sent_at)>Math.floor(Date.now()/1000)-900)return generic();
  const token=await newEmailToken(30*60);
  const now=Math.floor(Date.now()/1000);
  // Recheck the cooldown and ownership in the write, after any concurrent request.
  const saved=await env.DB.prepare(`INSERT INTO password_resets (user_id,token_hash,expires_at,sent_at)
    SELECT id,?,?,? FROM users WHERE id=? AND email_verified_at IS NOT NULL
    ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,
    expires_at=excluded.expires_at,sent_at=excluded.sent_at WHERE password_resets.sent_at<=?`)
    .bind(token.tokenHash,token.expiresAt,now,user.id,now-900).run();
  if(saved.meta?.changes!==1)return generic();
  await sendPasswordResetEmail(env,{to:email,displayName:user.display_name,token:token.token,origin:new URL(request.url).origin});
  return generic();
}
