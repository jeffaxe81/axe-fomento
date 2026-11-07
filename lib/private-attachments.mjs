import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';

export const MAX_FILE_BYTES=2*1024*1024;
export const MAX_MULTIPART_BYTES=MAX_FILE_BYTES+16384;
export function key(){
 const encoded=process.env.ATTACHMENT_ENCRYPTION_KEY;
 if(!encoded||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw new Error('Chave de anexo inválida');
 const result=Buffer.from(encoded,'base64');
 if(result.length!==32)throw new Error('Chave de anexo inválida');
 return result;
}
export function detectAllowedMedia(input){
 const b=Buffer.from(input);
 if(b.length>=5&&b.subarray(0,5).toString('ascii')==='%PDF-')return 'application/pdf';
 if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255&&b.at(-2)===255&&b.at(-1)===217)return 'image/jpeg';
 return null;
}
export function safeFileName(value){
 return String(value).normalize('NFC').replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g,'_').trim().slice(0,120);
}
export function encryptAttachment(bytes,context){
 const data=Buffer.from(bytes),nonce=randomBytes(12);
 const c=createCipheriv('aes-256-gcm',key(),nonce);
 c.setAAD(Buffer.from(context));
 const ciphertext=Buffer.concat([c.update(data),c.final()]);
 return {ciphertext,nonce,authTag:c.getAuthTag(),sha256:createHash('sha256').update(data).digest('hex')};
}
export function decryptAttachment(row,context){
 const d=createDecipheriv('aes-256-gcm',key(),Buffer.from(row.nonce));
 d.setAAD(Buffer.from(context));
 d.setAuthTag(Buffer.from(row.auth_tag));
 const plaintext=Buffer.concat([d.update(Buffer.from(row.ciphertext)),d.final()]);
 const original=Buffer.from(row.sha256,'hex');
 const hash=createHash('sha256').update(plaintext).digest();
 if(plaintext.length!==row.content_length||original.length!==hash.length||!timingSafeEqual(original,hash))
  throw new Error('Integridade do anexo comprometida');
 return plaintext;
}
