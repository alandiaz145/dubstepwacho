import React,{useEffect,useRef} from 'react';

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function TurnstileWidget({siteKey,onToken}) {
  const container = useRef(null);
  const onTokenRef = useRef(onToken);
  useEffect(()=>{onTokenRef.current=onToken},[onToken]);
  useEffect(()=>{
    if(!siteKey || !container.current)return;
    let cancelled=false;
    let widgetId;
    let timer;
    const render=()=>{
      if(cancelled)return;
      if(!window.turnstile){timer=window.setTimeout(render,100);return;}
      widgetId=window.turnstile.render(container.current,{
        sitekey:siteKey,
        callback:token=>onTokenRef.current(token),
        'expired-callback':()=>onTokenRef.current(''),
        'error-callback':()=>onTokenRef.current('')
      });
    };
    if(!document.querySelector(`script[src="${SCRIPT}"]`)){
      const script=document.createElement('script');
      script.src=SCRIPT;script.async=true;script.defer=true;
      document.head.appendChild(script);
    }
    render();
    return ()=>{
      cancelled=true;
      window.clearTimeout(timer);
      if(widgetId!==undefined && window.turnstile){try{window.turnstile.remove(widgetId)}catch{}}
      onTokenRef.current('');
    };
  },[siteKey]);
  return <div className="turnstile-box"><div ref={container}/><small>Verificación de seguridad mediante Cloudflare Turnstile.</small></div>;
}
