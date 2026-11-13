import {body,hashPassword,ready,response,sameOrigin,slugify,throttle,unavailable,validEmail,verifyTurnstile} from '../_auth.js';
import {emailDeliveryReady,newEmailToken,sendVerificationEmail} from '../_email.js';

export async function onRequestPost({request,env}) {
  if(!ready(env)) return unavailable();
  if(!emailDeliveryReady(env))return response({error:'La verificación de correo aún no está disponible.'},503);
  if(!sameOrigin(request)) return response({error:'Origen no permitido.'},403);
  if(!await throttle(env.DB,request,'register',4)) return response({error:'Demasiados intentos. Probá más tarde.'},429);
  let input;
  try { input=await body(request); } catch { return response({error:'Solicitud inválida.'},400); }
  if (!await verifyTurnstile(env,input.turnstileToken,request))
    return response({error:'No pudimos verificar la solicitud. Recargá el desafío de seguridad.'},403);
  const email=String(input.email||'').trim().toLowerCase();
  const displayName=String(input.displayName||'').trim();
  const password=input.password;
  const role=input.role==='artist'?'artist':'listener';
  if(!validEmail(email)||displayName.length<2||displayName.length>70||typeof password!=='string'||password.length<12||password.length>128)
    return response({error:'Revisá el nombre, correo y contraseña (mínimo 12 caracteres).'},400);
  const id=crypto.randomUUID();
  const {hash,salt}=await hashPassword(password);
  const verification=await newEmailToken();
  const sentAt=Math.floor(Date.now()/1000);
  try {
    const statements=[
      env.DB.prepare('INSERT INTO users (id,email,display_name,role,password_hash,password_salt) VALUES (?,?,?,?,?,?)').bind(id,email,displayName,role,hash,salt)
    ];
    if(role==='artist') {
      const slug=slugify(displayName);
      if(!slug)return response({error:'Elegí otro nombre artístico.'},400);
      statements.push(env.DB.prepare('INSERT INTO artist_profiles (user_id,slug) VALUES (?,?)').bind(id,`${slug}-${id.slice(0,8)}`));
    }
    statements.push(env.DB.prepare('INSERT INTO email_verifications (user_id,token_hash,expires_at,sent_at) VALUES (?,?,?,?)')
      .bind(id,verification.tokenHash,verification.expiresAt,sentAt));
    await env.DB.batch(statements);
  } catch { return response({error:'No se pudo crear la cuenta. Probá con otro correo.'},409); }
  const sent=await sendVerificationEmail(env,{to:email,displayName,token:verification.token,origin:new URL(request.url).origin});
  if(!sent)return response({error:'No pudimos enviar el correo de verificación. Reintentá más tarde.'},503);
  return response({message:'Te enviamos un enlace para verificar tu correo. Revisá tu bandeja y spam.'},202);
}
