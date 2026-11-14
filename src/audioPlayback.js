// Call play() synchronously from the initiating action, preserving the user gesture.
// Only the latest attempt may report a failure to the UI.
export function createAudioPlayback(audio,onRejected){
  let generation=0;
  const attempt=async version=>{
    try{await audio.play();return version===generation;}
    catch(error){if(version===generation)onRejected(error);return false;}
  };
  return {
    start(source){
      const version=++generation;
      audio.src=source;
      audio.load();
      return attempt(version);
    },
    resume(){return attempt(++generation);},
    pause(){generation++;audio.pause();},
    dispose(){generation++;audio.pause();}
  };
}
