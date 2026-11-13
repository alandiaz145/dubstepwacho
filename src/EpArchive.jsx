import React,{useEffect,useRef,useState} from 'react';

export default function EpArchive({onPlay}) {
  const [volumes,setVolumes]=useState([]),[selected,setSelected]=useState(null),[tracks,setTracks]=useState([]),[error,setError]=useState('');
  const latestSelection=useRef(0);
  useEffect(()=>{let active=true;fetch('/api/eps/').then(r=>r.json()).then(data=>{if(active)setVolumes(Array.isArray(data.volumes)?data.volumes:[])}).catch(()=>{});return()=>{active=false}},[]);
  const open=async volume=>{
    const requestId=++latestSelection.current;
    setSelected(volume);setTracks([]);setError('');
    try{
      const response=await fetch(`/api/eps/${encodeURIComponent(volume.slug)}`);
      if(!response.ok)throw Error('No pudimos cargar las canciones de este volumen.');
      const data=await response.json();
      if(requestId===latestSelection.current)setTracks(Array.isArray(data.tracks)?data.tracks:[]);
    }catch(e){if(requestId===latestSelection.current)setError(e.message)}
  };
  if(!volumes.length)return null;
  return <section className="ep-archive"><h2>EDICIONES PUBLICADAS</h2><p>Escuchá las compilaciones de nuestra comunidad.</p>
    <div className="ep-volume-list">{volumes.map(volume=><button className={selected?.slug===volume.slug?'active':''} key={volume.slug} onClick={()=>open(volume)}>
      <small>{volume.year} · VOLUMEN {volume.number}</small><b>{volume.title}</b><span>Ver canciones →</span>
    </button>)}</div>
    {selected&&<div className="ep-track-list"><h3>{selected.title}</h3>{error&&<p role="status">{error}</p>}{tracks.map(track=><button key={track.id} onClick={()=>onPlay(track)}>▶ {track.position}. {track.artist} — {track.title}</button>)}{!tracks.length&&!error&&<p>Este volumen todavía no tiene canciones públicas.</p>}</div>}
  </section>;
}
