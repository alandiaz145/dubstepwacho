import React,{useCallback,useEffect,useState,useRef} from 'react';

const labels={pending_analysis:'En análisis',pending_review:'Pendiente de revisión',approved:'Aprobado',published:'Publicado',rejected:'Rechazado',withdrawn:'Retirado'};
const actionLabels={approve:'Aprobación',reject:'Rechazo',request_changes:'Cambios solicitados',publish:'Publicación',withdraw:'Retirada'};

export default function AdminPanel({account,onSessionExpired}) {
  const [tracks,setTracks]=useState([]),[events,setEvents]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  const latestRequest=useRef(0);
  const denyAccess=useCallback(result=>{
    if(![401,403].includes(result.status))return false;
    latestRequest.current++;setTracks([]);setEvents([]);setLoading(false);
    if(result.status===401)onSessionExpired?.();
    else setMessage('Tus permisos cambiaron. No se puede consultar esta información.');
    return true;
  },[onSessionExpired]);
  const refresh=useCallback(async()=>{
    if(account?.role!=='admin')return;
    const requestId=++latestRequest.current;
    setLoading(true);setMessage('');
    try {
      const [trackResult,historyResult]=await Promise.all([
        fetch('/api/admin/tracks',{credentials:'same-origin'}),
        fetch('/api/admin/history',{credentials:'same-origin'})
      ]);
      if(requestId!==latestRequest.current)return;
      if(denyAccess(trackResult)||denyAccess(historyResult))return;
      const [trackData,historyData]=await Promise.all([trackResult.json(),historyResult.json()]);
      if(requestId!==latestRequest.current)return;
      if(!trackResult.ok)throw Error(trackData.error||'No se pudo cargar la moderación.');
      setTracks(Array.isArray(trackData.tracks)?trackData.tracks:[]);
      if(!historyResult.ok)throw Error(historyData.error||'No se pudo cargar el historial.');
      setEvents(Array.isArray(historyData.events)?historyData.events:[]);
    }catch(error){if(requestId===latestRequest.current)setMessage(error.message)}finally{if(requestId===latestRequest.current)setLoading(false)}
  },[account?.role,denyAccess]);
  useEffect(()=>{refresh();return()=>{latestRequest.current++;}},[refresh]);
  const act=async(track,action)=>{
    if(busy)return;
    const withdrawing=action==='withdraw',rejecting=action==='reject';
    const reason=withdrawing||rejecting?window.prompt(withdrawing?'Motivo de retirada:':'Motivo del rechazo:',''):'';
    if((withdrawing||rejecting)&&(!reason||reason.trim().length<3))return;
    if((action==='publish'||action==='approve')&&!window.confirm(`¿Confirmás ${action==='publish'?'la publicación':'la aprobación'} de «${track.title}»?`))return;
    setBusy(track.id);setMessage('');
    try {
      const endpoint=['publish','withdraw'].includes(action)?'/api/admin/publication':'/api/admin/review';
      const result=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:track.id,action,reason})});
      if(denyAccess(result))return;
      const data=await result.json();
      if(!result.ok)throw Error(data.error||'No se pudo completar la acción.');
      setMessage('Acción guardada en el historial de moderación.');
      await refresh();
    }catch(error){setMessage(error.message)}finally{setBusy('')}
  };
  if(account?.role!=='admin')return <main className="inner"><h1>ACCESO RESTRINGIDO</h1><p>Este panel es exclusivo del equipo de moderación autorizado.</p></main>;
  return <main className="inner admin-panel">
    <p className="kicker">GESTIÓN PRIVADA DE LA COMUNIDAD</p><h1>MODERACIÓN</h1>
    <p>Las canciones enviadas permanecen privadas hasta completar el análisis de seguridad, la revisión y la publicación explícita.</p>
    <button className="outline" disabled={loading} onClick={refresh}>{loading?'Actualizando…':'Actualizar listado'}</button>
    {message&&<p role="status" className="admin-feedback">{message}</p>}
    <div className="stats"><span><b>{tracks.filter(t=>t.status==='pending_analysis'||t.status==='pending_review').length}</b>Pendientes</span><span><b>{tracks.filter(t=>t.status==='approved').length}</b>Aprobadas</span><span><b>{tracks.filter(t=>t.status==='published').length}</b>Publicadas</span></div>
    {tracks.length?tracks.map(track=><article className="pending admin-track" key={track.id}>
      <div><b>{track.title} — {track.artist}</b><p>{track.genre} · {labels[track.status]||track.status} · Escaneo: {track.scanStatus}</p><small>{track.createdAt} · {Math.ceil((track.audioBytes||0)/1024/1024)} MB</small>{track.reviewReason&&<p>Observación: {track.reviewReason}</p>}</div>
      <div className="admin-actions">
        {track.status==='pending_review'&&track.scanStatus==='clean'&&<button disabled={!!busy} onClick={()=>act(track,'approve')}>Aprobar</button>}
        {['pending_analysis','pending_review'].includes(track.status)&&<button disabled={!!busy} onClick={()=>act(track,'reject')}>Rechazar</button>}
        {track.status==='approved'&&track.scanStatus==='clean'&&<button className="lime" disabled={!!busy} onClick={()=>act(track,'publish')}>Publicar</button>}
        {track.status==='published'&&<button disabled={!!busy} onClick={()=>act(track,'withdraw')}>Retirar</button>}
      </div>
    </article>):<p>{loading?'Cargando registros…':'Todavía no hay canciones para moderar.'}</p>}
    <section className="admin-history" aria-label="Historial de moderación">
      <h2>ÚLTIMAS DECISIONES</h2>
      {events.length?events.map((event,index)=><article key={`${event.createdAt}-${index}`}>
        <strong>{actionLabels[event.action]||event.action}: {event.trackTitle}</strong>
        <small>{event.artistName} · {event.actorName} · {event.createdAt}</small>
        {event.reason&&<p>Motivo: {event.reason}</p>}
      </article>):<p>Todavía no hay decisiones registradas.</p>}
    </section>
  </main>;
}
