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
import {onRequestPost as submit} from '../../functions/api/tracks/submit.js';
import {onRequestPost as review} from '../../functions/api/admin/review.js';
import {onRequestPost as publication} from '../../functions/api/admin/publication.js';
import {onRequestGet as adminTracks} from '../../functions/api/admin/tracks.js';
import {onRequestGet as history} from '../../functions/api/admin/history.js';
import {onRequestGet as catalog} from '../../functions/api/tracks/index.js';
import {onRequestGet as cover} from '../../functions/api/tracks/cover/[id].js';
import {onRequestGet as eps} from '../../functions/api/eps/index.js';
import {onRequestGet as ep} from '../../functions/api/eps/[slug].js';
const routes={
  'GET /api/eps/':eps,
  'POST /api/tracks/submit':submit,'POST /api/admin/review':review,'POST /api/admin/publication':publication,
  'GET /api/admin/tracks':adminTracks,'GET /api/admin/history':history,'GET /api/tracks/':catalog,
  'POST /api/auth/register':register,'POST /api/auth/verify':verify,
  'POST /api/auth/login':login,'POST /api/auth/reset':reset,
  'POST /api/auth/forgot':forgot,'POST /api/auth/logout':logout,'GET /api/auth/me':me
};
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  const media=path.match(/^\/api\/tracks\/audio\/([^/]+)$/);
  if(media&&['GET','HEAD'].includes(request.method))return (request.method==='HEAD'?audioHead:audio)({request,env,params:{id:media[1]}});
  const artwork=path.match(/^\/api\/tracks\/cover\/([^/]+)$/);
  if(artwork&&request.method==='GET')return cover({request,env,params:{id:artwork[1]}});
  const volume=path.match(/^\/api\/eps\/([^/]+)$/);
  if(volume&&request.method==='GET')return ep({request,env,params:{slug:volume[1]}});
  const handler=routes[`${request.method} ${path}`];
  return handler?handler({request,env}):new Response('Not found',{status:404});
}};
