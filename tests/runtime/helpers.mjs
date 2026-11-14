import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const origin='https://dubstepwacho.test';
export async function startRuntime(bindings={}){
  const sent=[];
  const mf=new Miniflare({
    host:'127.0.0.1',modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],
    scriptPath:fileURLToPath(new URL('worker.js',import.meta.url)),
    compatibilityDate:'2026-07-01',d1Databases:['DB'],r2Buckets:['PRIVATE_MUSIC'],d1Persist:false,r2Persist:false,
    bindings:{AUTH_ENABLED:'true',TURNSTILE_SECRET_KEY:'test-only',RESEND_API_KEY:'test-only',VERIFICATION_EMAIL_FROM:'test@example.test',...bindings},
    outboundService:async request=>{
      const url=new URL(request.url);
      if(url.href==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return Response.json({success:true,hostname:'dubstepwacho.test'});
      assert.equal(url.href,'https://api.resend.com/emails','unexpected outbound traffic is forbidden');
      sent.push(await request.json());return Response.json({id:'test-only'});
    }
  });
  try{
    const db=await mf.getD1Database('DB');
    const migrations=new URL('../../migrations/',import.meta.url);
    for(const name of readdirSync(migrations).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
      const sql=readFileSync(new URL(name,migrations),'utf8').replace(/^--.*$/gm,'');
      await db.batch(sql.split(';').map(query=>query.trim()).filter(Boolean).map(query=>db.prepare(query)));
    }
    return {mf,db,sent,bucket:await mf.getR2Bucket('PRIVATE_MUSIC'),close:()=>mf.dispose()};
  }catch(error){await mf.dispose();throw error;}
}
