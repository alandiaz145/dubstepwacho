// Accept secure remote media and our published same-origin audio endpoint.
// Reject arbitrary relative paths, javascript: URLs and visual-only demos.
const isPlayableSource = url => typeof url==='string' && (
  /^https:\/\/[^\s]+$/i.test(url) ||
  /^\/api\/tracks\/audio\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(url)
);
export const playableTracks = tracks => tracks.filter(track => isPlayableSource(track?.url));

export function nextPlayable(tracks, currentId, direction = 1, excludedIds = new Set()) {
  const playable = playableTracks(tracks);
  if (!playable.length) return null;
  const currentIndex = playable.findIndex(track => track.id === currentId);
  for(let offset=1;offset<=playable.length;offset++){
    const index=currentIndex===-1
      ?(direction>=0?offset-1:playable.length-offset)
      :(currentIndex+offset*(direction>=0?1:-1)+playable.length*offset)%playable.length;
    const candidate=playable[index];
    if(!excludedIds.has(candidate.id))return candidate;
  }
  return null;
}
