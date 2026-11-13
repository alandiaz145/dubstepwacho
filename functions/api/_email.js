const encoder=new TextEncoder();

export const emailDeliveryReady=env=>Boolean(env?.RESEND_API_KEY&&env?.VERIFICATION_EMAIL_FROM);

export async function newEmailToken() {
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  const tokenHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
  return {token,tokenHash,expiresAt:Math.floor(Date.now()/1000)+60*60};
}

export async function hashEmailToken(token) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
}

// Optional provider integration. No email is sent until a verified sender and API key exist.
export async function sendVerificationEmail(env,{to,displayName,token,origin},send=fetch) {
  if(!emailDeliveryReady(env))return false;
  const link=`${origin}/?verify=${encodeURIComponent(token)}`;
  const text=`Hola ${displayName},\n\nConfirmá tu correo para activar tu cuenta DubstepWacho:\n${link}\n\nEl enlace vence en 1 hora. Si no solicitaste una cuenta, ignorá este mensaje.`;
  try {
    const result=await send('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:env.VERIFICATION_EMAIL_FROM,to:[to],subject:'Confirmá tu correo — DubstepWacho',text}),
      signal:AbortSignal.timeout(8000)
    });
    return result.ok;
  }catch{return false}
}
