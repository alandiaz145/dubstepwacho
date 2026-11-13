import {currentUser,ready,response,sameOrigin,unavailable} from './_auth.js';

export const genres=new Set(['Dubstep','Brostep','Riddim','Tearout','Deep Dubstep','Halftime','Drum & Bass','Trap','Bass House','Experimental','Otros']);
export const isMp3=bytes=>{
  if(bytes.length<4) return false;
  // ID3v2 tags or a compatible MPEG Layer III sync frame.
  if(bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33&&bytes[3]>=2&&bytes[3]<=4) return true;
  return bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0&&(bytes[1]&0x06)===0x02;
};
export const coverType=bytes=>{
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255) return 'image/jpeg';
  return null;
};
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
export const requireUser=async(request,env,role)=>{
  if(!ready(env)) return {error:unavailable()};
  const user=await currentUser(request,env.DB);
  if(!user) return {error:response({error:'Iniciá sesión para continuar.'},401)};
  if(role&&user.role!==role&&user.role!=='admin') return {error:response({error:'No tenés permisos para esta acción.'},403)};
  return {user};
};
export const requireMutation=request=>sameOrigin(request)?null:response({error:'Origen no permitido.'},403);
