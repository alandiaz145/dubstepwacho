import React from 'react';
import TurnstileWidget from './TurnstileWidget.jsx';

export default function AccountEmailForm({kind,enabled,siteKey,token,busy,challengeVersion,onToken,onSubmit}){
  const resend=kind==='resend';
  return <>
    <h2>{resend?'REENVIAR VERIFICACIÓN':'RECUPERAR ACCESO'}</h2>
    <p>{resend?'Si tu cuenta está pendiente de verificación, recibirás un nuevo enlace cuando corresponda.':'Si tu correo está verificado, recibirás un enlace válido por 30 minutos.'}</p>
    {!enabled&&<p className="caution">El envío de enlaces todavía no está habilitado.</p>}
    <form onSubmit={onSubmit}>
      <label>Correo<input name="email" type="email" required autoComplete="email"/></label>
      {enabled&&siteKey&&<TurnstileWidget key={challengeVersion} siteKey={siteKey} onToken={onToken}/>}
      <button className="lime" disabled={!enabled||!token||busy}>{busy?'Procesando…':resend?'Reenviar enlace':'Enviar enlace'}</button>
    </form>
  </>;
}
