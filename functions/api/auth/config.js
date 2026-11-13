import {ready,response} from '../_auth.js';
import {emailDeliveryReady} from '../_email.js';

export function onRequestGet({env}) {
  const sitekey = typeof env?.TURNSTILE_SITE_KEY === 'string' ? env.TURNSTILE_SITE_KEY.trim() : '';
  const registrationEnabled = ready(env) && emailDeliveryReady(env) && Boolean(env.TURNSTILE_SECRET_KEY && sitekey);
  return response({registrationEnabled,turnstileSiteKey:registrationEnabled?sitekey:null});
}
