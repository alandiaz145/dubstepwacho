import {currentUser,ready,response,unavailable} from '../_auth.js';

export async function onRequestGet({request,env}) {
  if(!ready(env)) return unavailable();
  try{return response({user:await currentUser(request,env.DB)})}
  catch{return response({error:'No se pudo comprobar la sesión.'},503)}
}
