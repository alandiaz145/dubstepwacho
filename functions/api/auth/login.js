import {body,createSession,ready,response,sameOrigin,sessionCookie,throttle,unavailable,validEmail,verifyPassword} from '../_auth.js';

export async function onRequestPost({request,env}) {
  if(!ready(env)) return unavailable();
  if(!sameOrigin(request)) return response({error:'Origen no permitido.'},403);
  if(!await throttle(env.DB,request,'login',8)) return response({error:'Demasiados intentos. Probá más tarde.'},429);
  let input;
  try {input=await body(request)} catch {return response({error:'Solicitud inválida.'},400)}
  const email=String(input.email||'').trim().toLowerCase();
  if(!validEmail(email)||typeof input.password!=='string'||input.password.length>128) return response({error:'Credenciales inválidas.'},401);
  const user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  // Spend comparable work when the account is absent to reduce email enumeration.
  const ok=await verifyPassword(input.password,user?.password_salt||'00'.repeat(16),user?.password_hash||'00'.repeat(32));
  if(!user||!ok||!user.email_verified_at) return response({error:'Credenciales inválidas o correo sin verificar.'},401);
  const token=await createSession(env.DB,user.id,{hash:user.password_hash,salt:user.password_salt});
  if(!token)return response({error:'Credenciales inválidas o correo sin verificar.'},401);
  return response({user:{id:user.id,email:user.email,displayName:user.display_name,role:user.role}},200,{'Set-Cookie':sessionCookie(token)});
}
