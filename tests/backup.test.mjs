import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { encryptDumpStream, verifyEncryptedBackup, writeManifest, fingerprint } from '../scripts/backup-crypto.mjs';

test('Backup: GCM, SHA-256, header e adulteração detectada',async()=>{
 const old=process.env.BACKUP_ENCRYPTION_KEY;
 process.env.BACKUP_ENCRYPTION_KEY=Buffer.alloc(32,17).toString('base64');
 const directory=await mkdtemp(join(tmpdir(),'axe-fomento-backup-test-'));
 const file=join(directory,'backup.dump.enc');
 const source=Buffer.concat([Buffer.from('PGDMP'),Buffer.alloc(9000,0x42)]);
 try{
  const manifest=await encryptDumpStream(Readable.from([source]),file);
  await writeManifest(file,manifest);
  assert.notDeepEqual(await readFile(file),source,'Nunca gravar o dump em texto puro');
  const good=await verifyEncryptedBackup(file);
  assert.equal(good.bytes,source.length);
  const corrupt=await readFile(file);corrupt[102]^=1;
  await writeFile(file,corrupt);
  await assert.rejects(verifyEncryptedBackup(file),'Adulteração deve invalidar GCM');
  await writeFile(file,Buffer.from('PGDMP'));
  await assert.rejects(verifyEncryptedBackup(file),'Dump sem autenticação deve ser recusado');
  assert.equal(fingerprint('postgresql://u:secret@db:5432/fomento'),
    fingerprint('postgresql://v:other@DB/fomento'));
 }finally{
  await rm(directory,{recursive:true,force:true});
  if(old===undefined)delete process.env.BACKUP_ENCRYPTION_KEY;
  else process.env.BACKUP_ENCRYPTION_KEY=old;
 }
});
