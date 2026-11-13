import {currentUser,ready,response,unavailable} from '../_auth.js';

export async function onRequestGet({request,env}) {
  if(!ready(env)) return unavailable();
  return response({user:await currentUser(request,env.DB)});
}
