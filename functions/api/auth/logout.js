import {deleteCookie,invalidateSession,ready,response,sameOrigin,unavailable} from '../_auth.js';

export async function onRequestPost({request,env}) {
  if(!ready(env)) return unavailable();
  if(!sameOrigin(request)) return response({error:'Origen no permitido.'},403);
  await invalidateSession(request,env.DB);
  return response({ok:true},200,{'Set-Cookie':deleteCookie});
}
