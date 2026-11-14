import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hashEmailToken} from '../functions/api/_email.js';
import {onRequestPost as forgot} from '../functions/api/auth/forgot.js';
import {onRequestPost as resend} from '../functions/api/auth/resend.js';

const origin='https://dubstepwacho.pages.dev';
for(const [name,endpoint,table,verified,parameter] of [
  ['forgot',forgot,'password_resets','verified','reset'],
  ['resend',resend,'email_verifications',null,'verify']
]){
  test(`${name}: concurrent requests send one email and keep the delivered token usable`,async()=>{
    const sql=new DatabaseSync(':memory:');
    const originalFetch=globalThis.fetch;
    try{
      for(const file of ['0001_auth.sql','0003_email_verification.sql','0004_password_reset.sql'])
        sql.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
      sql.prepare(`INSERT INTO users(id,email,display_name,role,password_hash,password_salt,email_verified_at)
        VALUES (?,?,?,?,?,?,?)`).run('u1','artist@example.test','Artist','artist','hash','salt',verified);
      if(name==='resend')sql.prepare('INSERT INTO email_verifications VALUES (?,?,?,?)').run('u1','old',0,0);
      const sent=[];
      globalThis.fetch=async(url,options)=>{
        if(url.includes('siteverify'))return Response.json({success:true,hostname:'dubstepwacho.pages.dev'});
        assert.equal(url,'https://api.resend.com/emails');
        sent.push(JSON.parse(options.body));
        return Response.json({id:'test-only'});
      };
      let reads=0,release;
      const gate=new Promise(resolve=>{release=resolve;});
      const DB={prepare(query){return {bind(...args){return {
        async first(){
          const snapshot=sql.prepare(query).get(...args)||null;
          if(query.includes('SELECT users.id')){
            reads++;if(reads===2)release();await gate;
          }
          return snapshot;
        },
        async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}};}
      }}}}};
      const env={DB,AUTH_ENABLED:'true',TURNSTILE_SECRET_KEY:'test-only',RESEND_API_KEY:'test-only',VERIFICATION_EMAIL_FROM:'test@example.test'};
      const request=()=>new Request(`${origin}/api/auth/${name}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
        body:JSON.stringify({email:'artist@example.test',turnstileToken:'test-only'})});
      const results=await Promise.all([endpoint({env,request:request()}),endpoint({env,request:request()})]);
      assert.deepEqual(results.map(r=>r.status),[200,200]);
      assert.deepEqual(await results[0].json(),await results[1].json());
      assert.equal(sent.length,1);
      const link=new URL(sent[0].text.match(/https:\/\/[^\s]+/)[0]);
      const stored=sql.prepare(`SELECT token_hash FROM ${table}`).get();
      assert.equal(stored.token_hash,await hashEmailToken(link.searchParams.get(parameter)));
      assert.equal((await endpoint({env,request:request()})).status,200);
      assert.equal(sent.length,1);
    }finally{globalThis.fetch=originalFetch;sql.close();}
  });
}
