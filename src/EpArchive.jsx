import React,{useEffect,useRef,useState} from 'react';

export default function EpArchive({onPlay}) {
  const [volumes,setVolumes]=useState([]),[selected,setSelected]=useState(null),[tracks,setTracks]=useState([]),[error,setError]=useState('');
  const [loadingIndex,setLoadingIndex]=useState(true),[indexError,setIndexError]=useState(''),[indexAttempt,setIndexAttempt]=useState(0),[loadingTracks,setLoadingTracks]=useState(false);
  const latestSelection=useRef(0),trackRequest=useRef(null);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setLoadingIndex(true);setIndexError('');
    fetch('/api/eps/',{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error();
      const data=await response.json();
      if(!Array.isArray(data.volumes))throw Error();
      if(active)setVolumes(data.volumes);
    }).catch(error=>{if(active&&error.name!=='AbortError')setIndexError('No pudimos cargar las ediciones publicadas.');})
      .finally(()=>{if(active)setLoadingIndex(false);});
    return()=>{active=false;controller.abort();};
  },[indexAttempt]);
  useEffect(()=>()=>{latestSelection.current++;trackRequest.current?.abort();},[]);
  const open=async volume=>{
    const requestId=++latestSelection.current;
    trackRequest.current?.abort();
    const controller=new AbortController();trackRequest.current=controller;
    setSelected(volume);setTracks([]);setError('');setLoadingTracks(true);
    try{
      const response=await fetch(`/api/eps/${encodeURIComponent(volume.slug)}`,{signal:controller.signal});
      if(!response.ok)throw Error();
      const data=await response.json();
      if(!Array.isArray(data.tracks))throw Error();
      if(requestId===latestSelection.current)setTracks(data.tracks);
    }catch(error){
      if(requestId===latestSelection.current&&error.name!=='AbortError')setError('No pudimos cargar las canciones de este volumen.');
    }finally{if(requestId===latestSelection.current)setLoadingTracks(false);}
  };
  if(!loadingIndex&&!indexError&&!volumes.length)return null;
  return <section className="ep-archive" aria-label="Archivo de EPs"><h2>EDICIONES PUBLICADAS</h2><p>Escuchá las compilaciones de nuestra comunidad.</p>
    {loadingIndex&&<p role="status">Cargando ediciones publicadas…</p>}
    {indexError&&<><p role="status">{indexError}</p><button className="outline" onClick={()=>setIndexAttempt(value=>value+1)}>Reintentar ediciones</button></>}
    <div className="ep-volume-list">{volumes.map(volume=><button className={selected?.slug===volume.slug?'active':''} aria-pressed={selected?.slug===volume.slug} key={volume.slug} onClick={()=>open(volume)}>
      <small>{volume.year} · VOLUMEN {volume.number}</small><b>{volume.title}</b><span>Ver canciones →</span>
    </button>)}</div>
    {selected&&<div className="ep-track-list" aria-busy={loadingTracks}><h3>{selected.title}</h3>
      {loadingTracks&&<p role="status">Cargando canciones…</p>}
      {error&&<><p role="status">{error}</p><button className="outline" onClick={()=>open(selected)}>Reintentar canciones</button></>}
      {tracks.map(track=><button key={track.id} onClick={()=>onPlay(track)}>▶ {track.position}. {track.artist} — {track.title}</button>)}
      {!loadingTracks&&!tracks.length&&!error&&<p>Este volumen todavía no tiene canciones públicas.</p>}
    </div>}
  </section>;
}
