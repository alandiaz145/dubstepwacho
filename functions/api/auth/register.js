import {body,createSession,hashPassword,ready,response,sameOrigin,sessionCookie,slugify,throttle,unavailable,validEmail,verifyTurnstile} from '../_auth.js';

export async function onRequestPost({request,env}) {
  if(!ready(env)) return unavailable();
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
  try {
    if(role==='artist') {
      const slug=slugify(displayName);
      if(!slug) return response({error:'Elegí otro nombre artístico.'},400);
      await env.DB.batch([
        env.DB.prepare('INSERT INTO users (id,email,display_name,role,password_hash,password_salt) VALUES (?,?,?,?,?,?)').bind(id,email,displayName,role,hash,salt),
        env.DB.prepare('INSERT INTO artist_profiles (user_id,slug) VALUES (?,?)').bind(id,`${slug}-${id.slice(0,8)}`)
      ]);
    } else {
      await env.DB.prepare('INSERT INTO users (id,email,display_name,role,password_hash,password_salt) VALUES (?,?,?,?,?,?)').bind(id,email,displayName,role,hash,salt).run();
    }
  } catch { return response({error:'No se pudo crear la cuenta. Probá con otro correo.'},409); }
  const token=await createSession(env.DB,id);
  return response({user:{id,email,displayName,role}},201,{'Set-Cookie':sessionCookie(token)});
}
