import test from 'node:test';
import assert from 'node:assert/strict';
import {detectAllowedMedia,safeFileName,encryptAttachment,decryptAttachment,
  MAX_FILE_BYTES,MAX_MULTIPART_BYTES} from '../lib/private-attachments.mjs';

const original=process.env.ATTACHMENT_ENCRYPTION_KEY;
process.env.ATTACHMENT_ENCRYPTION_KEY=Buffer.alloc(32,31).toString('base64');
const context='municipio-a:projeto-a:documento-a';

test('AF-018: formato permitido identificado por assinatura, nunca só pela extensão',()=>{
 assert.equal(detectAllowedMedia(Buffer.from('%PDF-1.4\nconteudo')), 'application/pdf');
 assert.equal(detectAllowedMedia(Buffer.from([137,80,78,71,13,10,26,10,1])), 'image/png');
 assert.equal(detectAllowedMedia(Buffer.from([255,216,255,0,255,217])), 'image/jpeg');
 assert.equal(detectAllowedMedia(Buffer.from('<script>alert(1)</script>')),null);
 assert.equal(detectAllowedMedia(Buffer.from('PK\x03\x04')),null);
 assert.equal(safeFileName('../segredo:projeto?.pdf'),'.._segredo_projeto_.pdf');
 assert.equal(MAX_FILE_BYTES,2097152);
 assert.ok(MAX_MULTIPART_BYTES>MAX_FILE_BYTES);
});
test('AF-018: criptografia AES-GCM preserva integridade e contexto do município',()=>{
 const source=Buffer.from('%PDF-1.7\nDado municipal privado');
 const sealed=encryptAttachment(source,context);
 assert.equal(sealed.nonce.length,12);
 assert.equal(sealed.authTag.length,16);
 assert.ok(!sealed.ciphertext.equals(source));
 const record={nonce:sealed.nonce,auth_tag:sealed.authTag,ciphertext:sealed.ciphertext,
  sha256:sealed.sha256,content_length:source.length};
 assert.deepEqual(decryptAttachment(record,context),source);
 assert.throws(()=>decryptAttachment(record,'municipio-b:projeto-a:documento-a'));
 assert.throws(()=>decryptAttachment({...record,sha256:'0'.repeat(64)},context));
 assert.throws(()=>decryptAttachment({...record,content_length:source.length+1},context));
 assert.throws(()=>decryptAttachment({...record,auth_tag:Buffer.alloc(16)},context));
});
test('AF-018: chave ausente ou inadequada não permite criptografar',()=>{
 const valid=process.env.ATTACHMENT_ENCRYPTION_KEY;
 try{
  delete process.env.ATTACHMENT_ENCRYPTION_KEY;
  assert.throws(()=>encryptAttachment(Buffer.from('texto'),context));
  process.env.ATTACHMENT_ENCRYPTION_KEY='invalida';
  assert.throws(()=>encryptAttachment(Buffer.from('texto'),context));
 }finally{process.env.ATTACHMENT_ENCRYPTION_KEY=valid;}
});
process.on('exit',()=>{if(original===undefined)delete process.env.ATTACHMENT_ENCRYPTION_KEY;
 else process.env.ATTACHMENT_ENCRYPTION_KEY=original;});
