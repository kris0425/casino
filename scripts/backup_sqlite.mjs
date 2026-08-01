import { DatabaseSync } from 'node:sqlite';

const [source,target]=process.argv.slice(2);
if(!source||!target) throw new Error('usage: node backup_sqlite.mjs <source> <target>');
const escaped=target.replaceAll("'","''");
const sourceDb=new DatabaseSync(source);
sourceDb.exec(`VACUUM INTO '${escaped}'`);
sourceDb.close();
const backupDb=new DatabaseSync(target,{readOnly:true});
const integrity=backupDb.prepare('PRAGMA integrity_check').get();
backupDb.close();
if(integrity.integrity_check!=='ok') throw new Error(`backup integrity check failed: ${integrity.integrity_check}`);
console.log('BACKUP_OK');
