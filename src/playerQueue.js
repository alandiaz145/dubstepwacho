// The radio can only move to tracks with an authorized, playable source.
export const playableTracks = tracks => tracks.filter(track => typeof track.url === 'string' && /^https:\/\//.test(track.url));

export function nextPlayable(tracks, currentId, direction = 1) {
  const playable = playableTracks(tracks);
  if (!playable.length) return null;
  const currentIndex = playable.findIndex(track => track.id === currentId);
  if (currentIndex === -1) return direction >= 0 ? playable[0] : playable[playable.length - 1];
  return playable[(currentIndex + (direction >= 0 ? 1 : -1) + playable.length) % playable.length];
}
