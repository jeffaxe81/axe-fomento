import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform, Writable } from 'node:stream';

export function backupKey(){
  const encoded=process.env.BACKUP_ENCRYPTION_KEY;
  if(!encoded||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw new Error('BACKUP_ENCRYPTION_KEY deve ter 32 bytes em base64');
  const key=Buffer.from(encoded,'base64');
  if(key.length!==32)throw new Error('Chave de backup inválida');
  return key;
}
export function postgresEnv(urlText){
  const url=new URL(urlText);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('URL PostgreSQL inválida');
  const e={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',
    PGDATABASE:decodeURIComponent(url.pathname.slice(1)),
    PGUSER:decodeURIComponent(url.username),
    PGPASSWORD:decodeURIComponent(url.password)};
  // Avoid supplying connection strings to subprocess environment or shell arguments.
  delete e.DATABASE_URL;delete e.DATABASE_ADMIN_URL;delete e.RESTORE_TARGET_URL;
  return e;
}
export function fingerprint(urlText){
  const u=new URL(urlText);
  return [u.hostname.toLowerCase(),u.port||'5432',
    decodeURIComponent(u.pathname.slice(1))].join(':');
}
export async function encryptDumpStream(stream,outputPath){
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',backupKey(),nonce);
  const hash=createHash('sha256');
  const hashCiphertext=new Transform({transform(chunk,_encoding,cb){hash.update(chunk);cb(null,chunk);}});
  await pipeline(stream,cipher,hashCiphertext,createWriteStream(outputPath,{flags:'wx',mode:0o600}));
  return {format:'axe-fomento-pgcustom-v1',algorithm:'aes-256-gcm',
    nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),
    sha256:hash.digest('hex'),createdAt:new Date().toISOString()};
}
export async function verifyEncryptedBackup(encryptedFile){
  const manifest=JSON.parse(await readFile(encryptedFile+'.json','utf8'));
  if(manifest.format!=='axe-fomento-pgcustom-v1'||manifest.algorithm!=='aes-256-gcm'||
    !/^[a-f0-9]{64}$/.test(manifest.sha256))throw new Error('Manifesto inválido');
  const nonce=Buffer.from(manifest.nonce,'base64'),tag=Buffer.from(manifest.tag,'base64');
  if(nonce.length!==12||tag.length!==16)throw new Error('Nonce/tag inválidos');
  const decipher=createDecipheriv('aes-256-gcm',backupKey(),nonce);
  decipher.setAuthTag(tag);
  const hash=createHash('sha256');let prefix=Buffer.alloc(0),bytes=0;
  const inspection=new Transform({transform(chunk,_encoding,cb){
    hash.update(chunk);cb(null,chunk);
  }});
  const sink=new Writable({write(chunk,_encoding,cb){
    bytes+=chunk.length;
    if(prefix.length<5)prefix=Buffer.concat([prefix,chunk]).subarray(0,5);
    cb();
  }});
  await pipeline(createReadStream(encryptedFile),inspection,decipher,sink);
  if(hash.digest('hex')!==manifest.sha256)throw new Error('SHA-256 do backup divergente');
  if(prefix.toString('ascii')!=='PGDMP')throw new Error('Arquivo não é dump PostgreSQL custom');
  return {manifest,bytes};
}
export async function decryptBackupStream(encryptedFile,destination){
  const m=JSON.parse(await readFile(encryptedFile+'.json','utf8'));
  const decipher=createDecipheriv('aes-256-gcm',backupKey(),Buffer.from(m.nonce,'base64'));
  decipher.setAuthTag(Buffer.from(m.tag,'base64'));
  await pipeline(createReadStream(encryptedFile),decipher,destination);
}
export async function removeFailedBackup(file){
  await rm(file,{force:true});await rm(file+'.json',{force:true});
}
export async function writeManifest(file,manifest){
  await writeFile(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
}
