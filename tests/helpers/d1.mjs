import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

// Real SQL against an isolated in-memory database. This is not a D1 runtime emulator.
export function migratedDatabase(){
  const sql=new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  const migrations=new URL('../../migrations/',import.meta.url);
  for(const name of readdirSync(migrations).filter(name=>/^\d+.*\.sql$/.test(name)).sort())
    sql.exec(readFileSync(new URL(name,migrations),'utf8'));
  function statement(query,args=[]){
    return {
      bind(...values){return statement(query,values);},
      async first(){return sql.prepare(query).get(...args)||null;},
      async all(){return {results:sql.prepare(query).all(...args)};},
      run(){return {meta:{changes:sql.prepare(query).run(...args).changes}};}
    };
  }
  const DB={prepare:statement,async batch(statements){
    sql.exec('BEGIN');
    try{const results=statements.map(value=>value.run());sql.exec('COMMIT');return results;}
    catch(error){sql.exec('ROLLBACK');throw error;}
  }};
  return {sql,DB,close:()=>sql.close()};
}
