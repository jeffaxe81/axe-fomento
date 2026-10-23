import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function encode32(b:Buffer):string {
  let bits=0,value=0,out='';
  for(const c of b){value=(value<<8)|c;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}
  if(bits>0)out+=alphabet[(value<<(5-bits))&31];
  return out;
}
function decode32(s:string):Buffer {
  if(!/^[A-Z2-7]{16,64}$/.test(s)) throw new Error('Segredo TOTP inválido');
  let bits=0,value=0;const result:number[]=[];
  for(const ch of s){value=(value<<5)|alphabet.indexOf(ch);bits+=5;
    if(bits>=8){result.push((value>>>(bits-8))&255);bits-=8;}}
  return Buffer.from(result);
}
function key():Buffer {
  const encoded=process.env.MFA_ENCRYPTION_KEY;
  if(!encoded||!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('MFA_ENCRYPTION_KEY (32 bytes em base64) é obrigatória');
  const k=Buffer.from(encoded,'base64');
  if(k.length!==32)throw new Error('Chave MFA inválida');
  return k;
}
export function generateTotpSecret():string{return encode32(randomBytes(20));}
export function encryptTotpSecret(secret:string):string {
  decode32(secret);
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),nonce);
  const payload=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return 'v1:'+Buffer.concat([nonce,cipher.getAuthTag(),payload]).toString('base64');
}
export function decryptTotpSecret(encrypted:string):string {
  if(!encrypted?.startsWith('v1:'))throw new Error('Segredo MFA com formato incompatível');
  const bytes=Buffer.from(encrypted.slice(3),'base64');
  if(bytes.length<29)throw new Error('Segredo MFA corrompido');
  const decipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  const secret=Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
  decode32(secret);return secret;
}
function totpValue(secret:string,counter:number):string{
  const counterBytes=Buffer.alloc(8);counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest=createHmac('sha1',decode32(secret)).update(counterBytes).digest();
  const offset=digest[digest.length-1]&15;
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
/** Returns matched 30s counter; caller must enforce monotonic replay checks in DB. */
export function verifyTotp(secret:string,code:string,now=Date.now()):number|null{
  if(!/^\d{6}$/.test(code))return null;
  const current=Math.floor(now/30000);
  for(let delta=-1;delta<=1;delta++){
    const step=current+delta;if(step<0)continue;
    const expected=Buffer.from(totpValue(secret,step),'utf8');
    if(timingSafeEqual(expected,Buffer.from(code,'utf8')))return step;
  }
  return null;
}
export function otpauthUri(secret:string,email:string):string{
  return 'otpauth://totp/'+encodeURIComponent('AXE Fomento:'+email)+
    '?secret='+secret+'&issuer='+encodeURIComponent('AXE Fomento')+'&algorithm=SHA1&digits=6&period=30';
}
