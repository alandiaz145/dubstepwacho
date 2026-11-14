// Test-only Pages Functions adapter. Never included in application build output.
import {onRequestPost as register} from '../../functions/api/auth/register.js';
import {onRequestPost as verify} from '../../functions/api/auth/verify.js';
import {onRequestPost as login} from '../../functions/api/auth/login.js';
import {onRequestPost as forgot} from '../../functions/api/auth/forgot.js';
import {onRequestPost as reset} from '../../functions/api/auth/reset.js';
import {onRequestPost as logout} from '../../functions/api/auth/logout.js';
import {onRequestGet as me} from '../../functions/api/auth/me.js';
import {onRequestGet as audio} from '../../functions/api/tracks/audio/[id].js';
import {onRequestHead as audioHead} from '../../functions/api/tracks/audio/[id].js';
const routes={
  'POST /api/auth/register':register,'POST /api/auth/verify':verify,
  'POST /api/auth/login':login,'POST /api/auth/reset':reset,
  'POST /api/auth/forgot':forgot,'POST /api/auth/logout':logout,'GET /api/auth/me':me
};
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  const media=path.match(/^\/api\/tracks\/audio\/([^/]+)$/);
  if(media&&['GET','HEAD'].includes(request.method))return (request.method==='HEAD'?audioHead:audio)({request,env,params:{id:media[1]}});
  const handler=routes[`${request.method} ${path}`];
  return handler?handler({request,env}):new Response('Not found',{status:404});
}};
