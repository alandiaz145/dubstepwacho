// Report-only comparison of supplied snapshots. No storage client or delete path.
const positive=value=>Number.isSafeInteger(value)&&value>0;
const timestamp=value=>Number.isSafeInteger(value)&&value>=0;
const key=value=>typeof value==='string'&&value.length>0&&value.length<=1024&&!/[\u0000-\u001f\u007f]/.test(value);
const invalid=()=>{throw new Error('Invalid private inventory snapshot or policy.');};
const index=(records,stored)=>{
  if(!Array.isArray(records))invalid();
  const map=new Map();
  for(const record of records){
    if(!record||typeof record!=='object'||!key(record.key)||!positive(record.size)||map.has(record.key))invalid();
    if(stored&&record.uploadedAt!==null&&!timestamp(record.uploadedAt))invalid();
    map.set(record.key,record);
  }
  return map;
};

/**
 * Compare complete, point-in-time snapshots supplied by a future trusted adapter.
 * Millisecond clock and grace period are explicit; no retention policy is assumed.
 * Counts never authorize deletion. Even old unreferenced objects require a fresh
 * D1 check and human-approved retention policy before any storage mutation.
 */
export function summarizePrivateInventory(input){
  if(!input||typeof input!=='object'||!timestamp(input.now)||!positive(input.gracePeriodMs))invalid();
  const {now,gracePeriodMs}=input,references=index(input.references,false),objects=index(input.objects,true);
  const report={referencedPresent:0,missingObjects:0,sizeMismatches:0,unreferencedWithinGrace:0,unreferencedNeedsReview:0,unreferencedUnknownAge:0};
  for(const [objectKey,reference] of references){
    const object=objects.get(objectKey);
    if(!object)report.missingObjects++;
    else if(object.size!==reference.size)report.sizeMismatches++;
    else report.referencedPresent++;
  }
  for(const [objectKey,object] of objects){
    if(references.has(objectKey))continue;
    if(object.uploadedAt===null||object.uploadedAt>now)report.unreferencedUnknownAge++;
    else if(now-object.uploadedAt<gracePeriodMs)report.unreferencedWithinGrace++;
    else report.unreferencedNeedsReview++;
  }
  return report;
}
