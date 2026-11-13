import React,{useCallback,useEffect,useState} from 'react';

const labels={pending_analysis:'En análisis',pending_review:'Pendiente de revisión',approved:'Aprobado',published:'Publicado',rejected:'Rechazado',withdrawn:'Retirado'};

export default function AdminPanel({account}) {
  const [tracks,setTracks]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  const refresh=useCallback(async()=>{
    if(account?.role!=='admin')return;
    setLoading(true);
    try {
      const result=await fetch('/api/admin/tracks',{credentials:'same-origin'});
      const data=await result.json();
      if(!result.ok)throw Error(data.error||'No se pudo cargar la moderación.');
      setTracks(Array.isArray(data.tracks)?data.tracks:[]);
    }catch(error){setMessage(error.message)}finally{setLoading(false)}
  },[account?.role]);
  useEffect(()=>{refresh()},[refresh]);
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
  </main>;
}
