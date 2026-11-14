#!/usr/bin/env node
import {DatabaseSync,constants} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const required={
  users:['id','email','display_name','role','password_hash','password_salt','created_at'],
  sessions:['token_hash','user_id','expires_at','created_at'],
  auth_attempts:['key','count','window_start'],
  artist_profiles:['user_id','slug'],
  tracks:['id','user_id','status','scan_status','audio_key','cover_key','audio_sha256'],
  moderation_events:['id','track_id','actor_id','action','reason','created_at']
};
const limit=128*1024*1024;

// Restore only into memory. This does not connect to Cloudflare or authorize migrations.
export function verifyD1Backup(sql,expectedCounts){
  const raw=typeof sql==='string'?Buffer.from(sql):Buffer.isBuffer(sql)?sql:null;
  if(!raw?.length||raw.length>limit)throw Error('Exportación vacía o superior al límite local de 128 MiB.');
  try{sql=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);}catch{throw Error('La exportación no es UTF-8 válido.');}
  if(!sql.trim())throw Error('Exportación vacía.');
  if(expectedCounts!==undefined&&(!expectedCounts||typeof expectedCounts!=='object'||Array.isArray(expectedCounts)))throw Error('Recuentos esperados inválidos.');
  const db=new DatabaseSync(':memory:',{allowExtension:false});
  try{
    const denied=new Set([constants.SQLITE_ATTACH,constants.SQLITE_DETACH,constants.SQLITE_CREATE_VTABLE,
      constants.SQLITE_DROP_VTABLE,constants.SQLITE_CREATE_TRIGGER,constants.SQLITE_CREATE_TEMP_TRIGGER,
      constants.SQLITE_CREATE_TEMP_TABLE,constants.SQLITE_CREATE_TEMP_INDEX,constants.SQLITE_CREATE_TEMP_VIEW]);
    const pragmas=new Set(['foreign_keys','defer_foreign_keys','user_version']);
    const functions=new Set(['strftime','datetime','date','time','current_timestamp','current_date','current_time','hex','unhex']);
    db.setAuthorizer((action,first,second)=>{
      if(denied.has(action))return constants.SQLITE_DENY;
      if(action===constants.SQLITE_PRAGMA&&!pragmas.has(first?.toLowerCase()))return constants.SQLITE_DENY;
      if(action===constants.SQLITE_FUNCTION&&!functions.has(second?.toLowerCase()))return constants.SQLITE_DENY;
      return constants.SQLITE_OK;
    });
    try{db.exec(sql);}catch{throw Error('Exportación SQL inválida o contiene operaciones no permitidas.');}
    db.setAuthorizer(()=>constants.SQLITE_OK);
    if(db.isTransaction)throw Error('La exportación deja una transacción incompleta.');
    if(db.prepare('PRAGMA integrity_check').all().some(row=>row.integrity_check!=='ok'))throw Error('Falló la comprobación de integridad.');
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('La copia contiene referencias inconsistentes.');
    const counts={};
    for(const [table,columns] of Object.entries(required)){
      if(db.prepare('SELECT type FROM main.sqlite_schema WHERE name=?').get(table)?.type!=='table')throw Error(`Falta el esquema esperado de ${table}.`);
      const present=db.prepare("SELECT name FROM pragma_table_info(?, 'main')").all(table).map(row=>row.name);
      if(columns.some(column=>!present.includes(column)))throw Error(`Falta el esquema esperado de ${table}.`);
      counts[table]=db.prepare(`SELECT count(*) AS n FROM main."${table}"`).get().n;
      if(expectedCounts&&(!Number.isSafeInteger(expectedCounts[table])||expectedCounts[table]!==counts[table]))
        throw Error(`No coincide el recuento esperado de ${table}.`);
    }
    return {scope:'local-restore-only',sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length,
      integrity:'ok',foreignKeys:'ok',counts,comparedExpectedCounts:Boolean(expectedCounts)};
  }finally{db.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [file,expectedFile,...extra]=process.argv.slice(2);
    if(!file||extra.length)throw Error('Uso: node scripts/verify-d1-backup.mjs export.sql [recuentos.json]');
    if(!statSync(file).isFile()||statSync(file).size>limit)throw Error('Archivo inválido o superior a 128 MiB.');
    const expected=expectedFile?JSON.parse(readFileSync(expectedFile,'utf8')):undefined;
    console.log(JSON.stringify(verifyD1Backup(readFileSync(file),expected),null,2));
  }catch{
    // Never echo SQL, file paths, credentials or database rows in diagnostic logs.
    console.error('No se pudo verificar la copia. Se requiere SQL válido con el esquema esperado y recuentos coincidentes, si se proporcionan.');
    process.exitCode=1;
  }
}
