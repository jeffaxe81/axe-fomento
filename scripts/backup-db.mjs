import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { encryptDumpStream,postgresEnv,removeFailedBackup,writeManifest } from './backup-crypto.mjs';
if(!process.env.DATABASE_ADMIN_URL)throw new Error('DATABASE_ADMIN_URL obrigatório');
const dir=process.env.BACKUP_DIRECTORY;
if(!dir||!dir.startsWith('/'))throw new Error('Defina BACKUP_DIRECTORY com caminho absoluto');
await mkdir(dir,{recursive:true,mode:0o700});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const target=join(dir,'axe-fomento-'+stamp+'.dump.enc');
let stderr='';
try{
  const child=spawn('pg_dump',['--format=custom','--no-owner','--no-acl'],
    {env:postgresEnv(process.env.DATABASE_ADMIN_URL),stdio:['ignore','pipe','pipe']});
  child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-2000);});
  const closed=new Promise((resolve,reject)=>{
    child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('pg_dump retornou '+code)));
  });
  const [manifest]=await Promise.all([encryptDumpStream(child.stdout,target),closed]);
  await writeManifest(target,manifest);
  console.log('Backup criptografado concluído:',target);
  console.log('SHA-256:',manifest.sha256);
}catch(e){
  await removeFailedBackup(target);
  throw e;
}
