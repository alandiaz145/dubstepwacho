import {ready,response} from '../_auth.js';

export function onRequestGet({env}) {
  const sitekey = typeof env?.TURNSTILE_SITE_KEY === 'string' ? env.TURNSTILE_SITE_KEY.trim() : '';
  const registrationEnabled = ready(env) && Boolean(env.TURNSTILE_SECRET_KEY && sitekey);
  return response({registrationEnabled,turnstileSiteKey:registrationEnabled?sitekey:null});
}
