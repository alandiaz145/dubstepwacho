import {body,ready,response,sameOrigin,throttle,unavailable,validEmail,verifyTurnstile} from '../_auth.js';
import {emailDeliveryReady,newEmailToken,sendVerificationEmail} from '../_email.js';

export async function onRequestPost({request,env}) {
  if(!ready(env))return unavailable();
  if(!emailDeliveryReady(env))return response({error:'La verificación de correo aún no está disponible.'},503);
  if(!sameOrigin(request))return response({error:'Origen no permitido.'},403);
  if(!await throttle(env.DB,request,'resend-email',4))return response({error:'Demasiados intentos. Probá más tarde.'},429);
  let input;
  try{input=await body(request)}catch{return response({error:'Solicitud inválida.'},400)}
  if(!await verifyTurnstile(env,input.turnstileToken,request))return response({error:'No pudimos verificar la solicitud.'},403);
  const email=String(input.email||'').trim().toLowerCase();
  if(!validEmail(email))return response({error:'Revisá el correo ingresado.'},400);
  const generic=()=>response({message:'Si existe una cuenta pendiente, enviaremos un nuevo enlace cuando corresponda.'});
  const user=await env.DB.prepare(`SELECT users.id,users.display_name,email_verifications.sent_at
    FROM users JOIN email_verifications ON users.id=email_verifications.user_id
    WHERE users.email=? AND users.email_verified_at IS NULL`).bind(email).first();
  if(!user||Number(user.sent_at)>Math.floor(Date.now()/1000)-900)return generic();
  const verification=await newEmailToken();
  await env.DB.prepare('UPDATE email_verifications SET token_hash=?,expires_at=?,sent_at=? WHERE user_id=?')
    .bind(verification.tokenHash,verification.expiresAt,Math.floor(Date.now()/1000),user.id).run();
  await sendVerificationEmail(env,{to:email,displayName:user.display_name,token:verification.token,origin:new URL(request.url).origin});
  return generic();
}
