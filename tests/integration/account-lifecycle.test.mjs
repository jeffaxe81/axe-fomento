import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||!process.env.TEST_BASE_URL)
  throw new Error('Exige PostgreSQL de integração descartável.');
const run=promisify(execFile),base=process.env.TEST_BASE_URL;
const login=async(email,password)=>{
  const res=await fetch(base+'/api/auth/login',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password})
  });
  return {res,cookie:res.headers.get('set-cookie')?.match(/axes_fomento_session=[^;,\s]+/)?.[0]??''};
};
const change=(cookie,currentPassword,newPassword)=>fetch(base+'/api/auth/change-password',{
  method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},
  body:JSON.stringify({currentPassword,newPassword})
});
const privatePage=(cookie)=>fetch(base+'/projetos',{headers:{cookie},redirect:'manual'});
const isRedirect=(status)=>[303,307,308].includes(status);

test('Troca de senha revoga todos os tokens, emite novo SID e cria auditoria; recuperação MFA exige dupla identificação',async()=>{
  const db=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
  await db.connect();
  let tenant=null;
  const suffix=randomUUID().slice(0,8);
  const email='pwrotate-'+suffix+'@example.invalid';
  const oldPassword='SenhaAntiga-AxeFomento2026!';
  const newPassword='NovaSenha-AxeFomento2027!';
  try{
    tenant=(await db.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",['Troca Senha '+suffix])).rows[0].id;
    const userId=(await db.query("INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,'Teste Segurança',$2,$3,'admin') RETURNING id",
      [tenant,email,await bcrypt.hash(oldPassword,12)])).rows[0].id;
    const first=await login(email,oldPassword),second=await login(email,oldPassword);
    assert.equal(first.res.status,200);assert.equal(second.res.status,200);
    assert.ok(first.cookie&&second.cookie);
    assert.equal((await privatePage(first.cookie)).status,200);
    assert.equal((await change('',oldPassword,newPassword)).status,401);
    assert.equal((await change(first.cookie,oldPassword,'simples')).status,400);
    assert.equal((await change(first.cookie,'Errada!123A',newPassword)).status,401);
    assert.equal((await change(first.cookie,oldPassword,oldPassword)).status,401,'Reuso da senha antiga deve falhar');
    const changed=await change(first.cookie,oldPassword,newPassword);
    assert.equal(changed.status,200,'Troca válida aceita');
    const replacement=changed.headers.get('set-cookie')?.match(/axes_fomento_session=[^;,\s]+/)?.[0];
    assert.ok(replacement&&replacement!==first.cookie,'Novo identificador de sessão e cookie');
    assert.ok(isRedirect((await privatePage(first.cookie)).status));
    assert.ok(isRedirect((await privatePage(second.cookie)).status));
    assert.equal((await privatePage(replacement)).status,200);
    assert.equal((await login(email,oldPassword)).res.status,401);
    assert.equal((await login(email,newPassword)).res.status,200);
    const [event]=(await db.query("SELECT actor_user_id,action FROM audit_events WHERE record_id=$1 AND action='security.password_change'",[userId])).rows;
    assert.equal(event.actor_user_id,userId);
    const sessions=await db.query("SELECT id,revoked_at FROM user_sessions WHERE user_id=$1",[userId]);
    assert.ok(sessions.rows.filter(x=>x.revoked_at!==null).length>=2);
    const hash=(await db.query('SELECT password_hash FROM users WHERE id=$1',[userId])).rows[0].password_hash;
    assert.ok(await bcrypt.compare(newPassword,hash));

    await db.query("UPDATE users SET mfa_enabled=true,mfa_secret_cipher='v1:teste-unitario' WHERE id=$1",[userId]);
    const env={...process.env,
      MFA_RESET_USER_EMAIL:email,MFA_RESET_MUNICIPALITY_ID:tenant,
      MFA_RESET_TICKET:'SEC-'+suffix,MFA_RESET_REASON:'Dispositivo do autenticador perdido, identidade validada presencialmente',
      MFA_RESET_OPERATOR:'operador-interno',MFA_RESET_APPROVER:'operador-interno',
      MFA_RESET_CONFIRM:'RESET_MFA_REVOKE_ALL_SESSIONS'};
    await assert.rejects(run(process.execPath,['scripts/reset-mfa-admin.mjs'],{env}));
    assert.equal((await db.query('SELECT mfa_enabled FROM users WHERE id=$1',[userId])).rows[0].mfa_enabled,true);
    env.MFA_RESET_APPROVER='segundo-aprovador';
    const result=await run(process.execPath,['scripts/reset-mfa-admin.mjs'],{env});
    assert.match(result.stdout,/Reset MFA autorizado e auditado/);
    const [resetUser]=(await db.query('SELECT mfa_enabled,mfa_secret_cipher,mfa_last_step FROM users WHERE id=$1',[userId])).rows;
    assert.equal(resetUser.mfa_enabled,false);assert.equal(resetUser.mfa_secret_cipher,null);
    assert.ok(isRedirect((await privatePage(replacement)).status),'MFA reset revoga sessão da troca de senha');
    const [resetAudit]=(await db.query("SELECT metadata FROM audit_events WHERE record_id=$1 AND action='security.mfa_reset'",[userId])).rows;
    assert.equal(resetAudit.metadata.ticket,'SEC-'+suffix);
    assert.equal(resetAudit.metadata.approver,'segundo-aprovador');
    assert.equal((await login(email,newPassword)).res.status,200,'Recuperação exige novo login com senha correta');
  }finally{
    if(tenant){
      await db.query('DELETE FROM users WHERE municipality_id=$1',[tenant]);
      await db.query('DELETE FROM municipalities WHERE id=$1',[tenant]);
      await db.query('DELETE FROM audit_events WHERE municipality_id=$1',[tenant]);
    }
    await db.end();
  }
});
