import { verifyEncryptedBackup } from './backup-crypto.mjs';
if(!process.env.BACKUP_FILE)throw new Error('Defina BACKUP_FILE com caminho do .dump.enc');
const result=await verifyEncryptedBackup(process.env.BACKUP_FILE);
console.log('Backup verificado: SHA-256, AES-GCM e cabeçalho PostgreSQL');
console.log('Bytes descriptografados:',result.bytes);
