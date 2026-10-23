import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||!process.env.TEST_BASE_URL)
  throw new Error('MFA exige banco de testes descartável.');
const base=process.env.TEST_BASE_URL;
function totp(secret) {
  const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let value=0,bits=0,arr=[];
  for(const ch of secret){value=(value<<5)|a.indexOf(ch);bits+=5;if(bits>=8){arr.push((value>>>(bits-8))&255);bits-=8;}}
  const b=Buffer.alloc(8),step=Math.floor(Date.now()/30000);
  b.writeBigUInt64BE(BigInt(step));
  const digest=createHmac('sha1',Buffer.from(arr)).update(b).digest();
  const offset=digest[19]&15;
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
const post=(path,body,cookie='')=>fetch(base+path,{
  method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},
  body:JSON.stringify(body)
});
test('MFA exige segundo fator e impede acesso via cookie pendente; sessões são revogáveis',async()=>{
  const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
  await admin.connect();
  let municipality=null;
  const suffix=randomUUID().slice(0,8),email='mfa-'+suffix+'@example.invalid';
  const password='Mfa-Teste-Codigo2026!';
  try{
    municipality=(await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",['MFA Teste '+suffix])).rows[0].id;
    const uid=(await admin.query(
      "INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,'Segurança Teste',$2,$3,'admin') RETURNING id",
      [municipality,email,await bcrypt.hash(password,10)])).rows[0].id;
    let r=await post('/api/auth/login',{email,password});
    assert.equal(r.status,200);
    const original=r.headers.get('set-cookie')?.split(';')[0];assert.ok(original);
    r=await post('/api/auth/mfa/enroll',{action:'begin'},original);
    assert.equal(r.status,200);
    const {secret}=await r.json();assert.match(secret,/^[A-Z2-7]{32}$/);
    const [userBefore]=(await admin.query('SELECT mfa_pending_cipher,mfa_enabled FROM users WHERE id=$1',[uid])).rows;
    assert.equal(userBefore.mfa_enabled,false);
    assert.ok(userBefore.mfa_pending_cipher.startsWith('v1:'));
    assert.ok(!userBefore.mfa_pending_cipher.includes(secret),'TOTP seed must be encrypted at rest');
    const code=totp(secret);
    r=await post('/api/auth/mfa/enroll',{action:'confirm',code},original);
    assert.equal(r.status,200);
    const [userAfter]=(await admin.query('SELECT mfa_enabled,mfa_secret_cipher,mfa_pending_cipher FROM users WHERE id=$1',[uid])).rows;
    assert.equal(userAfter.mfa_enabled,true);assert.equal(userAfter.mfa_pending_cipher,null);
    assert.ok(userAfter.mfa_secret_cipher.startsWith('v1:'));

    r=await post('/api/auth/login',{email,password});
    assert.equal(r.status,202,'Password alone must not complete MFA');
    const pending=r.headers.get('set-cookie')?.split(';')[0];
    assert.ok(pending?.startsWith('axes_fomento_mfa_pending='));
    const blocked=await fetch(base+'/projetos',{headers:{cookie:pending},redirect:'manual'});
    assert.ok([303,307,308].includes(blocked.status),'Pending MFA cookie must not grant dashboard access');
    const wrong=code==='000000'?'999999':'000000';
    r=await post('/api/auth/mfa/verify',{code:wrong},pending);
    assert.equal(r.status,401,'Wrong TOTP is rejected');
    r=await post('/api/auth/mfa/verify',{code},pending);
    assert.equal(r.status,401,'Reusing enrollment TOTP is rejected (replay protection)');
    // Wait for next 30s TOTP step; a reused code must stay invalid.
    let fresh=code;
    const deadline=Date.now()+35000;
    while(fresh===code&&Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,1000));
      fresh=totp(secret);
    }
    assert.notEqual(fresh,code);
    r=await post('/api/auth/mfa/verify',{code:fresh},pending);
    assert.equal(r.status,200);
    const full=r.headers.get('set-cookie')?.split(';').find(x=>x.includes('axes_fomento_session='));
    // One Set-Cookie might be combined with clearing pending cookie.
    const cookie=r.headers.get('set-cookie')?.match(/axes_fomento_session=[^;\s,]+/)?.[0]??full?.trim();
    assert.ok(cookie);
    const page=await fetch(base+'/projetos',{headers:{cookie},redirect:'manual'});
    assert.equal(page.status,200);
    const sessions=await fetch(base+'/api/auth/sessions',{headers:{cookie}});
    assert.equal(sessions.status,200);
    assert.ok((await sessions.json()).sessions.length>=1);
    const revoked=await fetch(base+'/api/auth/sessions',{method:'DELETE',headers:{cookie}});
    assert.equal(revoked.status,200);
    assert.ok((await revoked.json()).revoked>=1,'Other sessions were revoked');
    assert.equal((await fetch(base+'/projetos',{headers:{cookie},redirect:'manual'})).status,200,'Current session remains authorized');
  }finally{
    if(municipality){
      await admin.query('DELETE FROM users WHERE municipality_id=$1',[municipality]);
      await admin.query('DELETE FROM municipalities WHERE id=$1',[municipality]);
    }
    await admin.end();
  }
});
