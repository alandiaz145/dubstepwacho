// Offline evidence validation only. This does not authenticate a scanner, consume a
// job, update D1 or authorize review/publication. Never use it as an HTTP handler.
const hash=/^[a-f0-9]{64}$/;
const identifier=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const version=/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/;
const verdicts=new Set(['clean','detected','invalid','error','expired']);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const positive=value=>integer(value)&&value>0;
const fields=(value,names)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const fail=code=>({valid:false,code});

/**
 * Validate a proposed scanner report against a trusted job snapshot and explicit
 * clock/signature-age policy. Inputs must be parsed JSON, not executable objects.
 * A valid report may contain a non-clean verdict: allClean must also be checked.
 * Even allClean=true is evidence only; authentication, current-state checks,
 * replay protection and an atomic audit transaction remain the caller's job.
 */
export function validateScanEvidence(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return fail('policy');
  const {job,result,now,maxSignatureAgeMs}=input;
  if(!integer(now)||!positive(maxSignatureAgeMs))return fail('policy');
  if(!fields(job,['id','attempt','trackId','objectVersion','createdAt','expiresAt','objects'])
    ||typeof job.id!=='string'||!identifier.test(job.id)
    ||typeof job.trackId!=='string'||!identifier.test(job.trackId)
    ||typeof job.objectVersion!=='string'||!identifier.test(job.objectVersion)
    ||!positive(job.attempt)||!integer(job.createdAt)||!integer(job.expiresAt)
    ||job.createdAt>=job.expiresAt||!fields(job.objects,['audio','cover']))return fail('job');
  for(const kind of ['audio','cover']){
    const object=job.objects[kind];
    if(!fields(object,['sha256','size'])||typeof object.sha256!=='string'||!hash.test(object.sha256)||!positive(object.size))return fail('job');
  }
  if(now<job.createdAt||now>=job.expiresAt)return fail('job_expired');
  if(!fields(result,['jobId','attempt','trackId','objectVersion','startedAt','finishedAt','engine','objects']))return fail('result');
  if(result.jobId!==job.id||result.attempt!==job.attempt||result.trackId!==job.trackId||result.objectVersion!==job.objectVersion)return fail('job_mismatch');
  if(!integer(result.startedAt)||!integer(result.finishedAt)||result.startedAt<job.createdAt
    ||result.finishedAt<result.startedAt||result.finishedAt>now)return fail('timestamps');
  const engine=result.engine;
  if(!fields(engine,['name','version','signatureVersion','signatureUpdatedAt'])
    ||![engine.name,engine.version,engine.signatureVersion].every(value=>typeof value==='string'&&version.test(value)))return fail('engine');
  if(!integer(engine.signatureUpdatedAt)||engine.signatureUpdatedAt>result.startedAt
    ||now-engine.signatureUpdatedAt>maxSignatureAgeMs)return fail('signatures');
  if(!fields(result.objects,['audio','cover']))return fail('objects');
  let allClean=true;
  for(const kind of ['audio','cover']){
    const object=result.objects[kind],expected=job.objects[kind];
    if(!fields(object,['sha256','size','verdict'])||typeof object.sha256!=='string'||!hash.test(object.sha256)
      ||!positive(object.size)||!verdicts.has(object.verdict))return fail('objects');
    if(object.sha256!==expected.sha256||object.size!==expected.size)return fail('object_mismatch');
    allClean=allClean&&object.verdict==='clean';
  }
  return {valid:true,allClean};
}
