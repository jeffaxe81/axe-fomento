import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { backupKey,fingerprint,postgresEnv,verifyEncryptedBackup } from './backup-crypto.mjs';

const file=process.env.BACKUP_FILE,target=process.env.RESTORE_TARGET_URL;
if(!file||!target||process.env.RESTORE_CONFIRMATION!=='RESTORE_DISPOSABLE_DATABASE')
  throw new Error('Defina BACKUP_FILE, RESTORE_TARGET_URL e RESTORE_CONFIRMATION=RESTORE_DISPOSABLE_DATABASE');
const u=new URL(target);
const db=decodeURIComponent(u.pathname.slice(1));
if(!/^fomento_restore_[a-z0-9_]{1,36}$/.test(db))
  throw new Error('Por segurança, o banco-alvo descartável deve começar por fomento_restore_');
if(process.env.DATABASE_ADMIN_URL&&fingerprint(target)===fingerprint(process.env.DATABASE_ADMIN_URL))
  throw new Error('O banco de destino não pode ser o banco de origem');
const verified=await verifyEncryptedBackup(file);
const manifest=JSON.parse(await readFile(file+'.json','utf8'));
const decipher=createDecipheriv('aes-256-gcm',backupKey(),Buffer.from(manifest.nonce,'base64'));
decipher.setAuthTag(Buffer.from(manifest.tag,'base64'));
const child=spawn('pg_restore',['--format=custom','--single-transaction','--exit-on-error',
  '--no-owner','--no-acl','--dbname',db],{env:postgresEnv(target),stdio:['pipe','ignore','pipe']});
let errors='';child.stderr.on('data',c=>{errors=(errors+String(c)).slice(-2000);});
const result=new Promise((resolve,reject)=>{
  child.on('error',reject);
  child.on('close',code=>code===0?resolve():reject(new Error('pg_restore falhou: '+code+' '+errors)));
});
await Promise.all([pipeline(createReadStream(file),decipher,child.stdin),result]);
console.log('Restore em banco descartável concluído; bytes verificados:',verified.bytes);
