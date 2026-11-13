// Read-only smoke checks against a deployed DubstepWacho installation.
// Usage: node scripts/check-public-endpoints.mjs [https://dubstepwacho.pages.dev]
const base=new URL(process.argv[2]||'https://dubstepwacho.pages.dev');
if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash){
  throw Error('Se requiere una URL HTTPS de origen sin credenciales.');
}

const checks=[
  ['/api/auth/config',200,data=>typeof data.registrationEnabled==='boolean','Configuración pública de registro'],
  ['/api/tracks/',200,data=>Array.isArray(data.tracks),'Catálogo público'],
  ['/api/admin/history',[401,503],data=>Boolean(data.error),'Historial privado sin sesión'],
  ['/api/eps/',[200,503],data=>Array.isArray(data.volumes),'Archivo EP (503 indica migración pendiente)']
];
let failures=0;
for(const [path,expected,validate,label] of checks){
  try{
    const url=new URL(path,base);
    const result=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'},redirect:'error'});
    const body=await result.json();
    const allowed=Array.isArray(expected)?expected:[expected];
    const valid=allowed.includes(result.status)&&validate(body);
    if(!valid)failures++;
    console.log(`${valid?'OK':'ERROR'} ${result.status} ${label}`);
  }catch(error){failures++;console.log(`ERROR ${label}: ${error.message}`)}
}
if(failures){console.error(`${failures} verificaciones fallaron.`);process.exitCode=1}
