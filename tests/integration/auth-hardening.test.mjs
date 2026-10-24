import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if (process.env.RUN_TEST_DB_ISOLATION !== 'yes' || !process.env.DATABASE_ADMIN_URL || !process.env.TEST_BASE_URL)
  throw new Error('Testes de autenticação exigem banco isolado.');

const base = process.env.TEST_BASE_URL;
test('Tentativas de login são limitadas por banco compartilhado entre instâncias',async()=>{
  const email='ratelimit-'+randomUUID().slice(0,8)+'@example.invalid';
  for(let i=0;i<5;i++){
    const r=await fetch(base+'/api/auth/login',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({email,password:'SenhaErrada12345!'})
    });
    assert.equal(r.status,401,'Até cinco tentativas inválidas retornam credenciais inválidas');
  }
  const denied=await fetch(base+'/api/auth/login',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password:'SenhaErrada12345!'})
  });
  assert.equal(denied.status,429,'Sexta tentativa deve ser bloqueada');
  assert.equal(denied.headers.get('retry-after'),'900');
});

test('Logout revoga a sessão no PostgreSQL, invalidando cookie anteriormente emitido',async()=>{
  const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
  await admin.connect();
  const suffix=randomUUID().slice(0,8);
  let municipality,uid;
  const email='logout-'+suffix+'@example.invalid',password='Sessao-Teste-Fomento2026!';
  try{
    municipality=(await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",['Logout Teste '+suffix])).rows[0].id;
    uid=(await admin.query("INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,'Admin Teste',$2,$3,'admin') RETURNING id",
      [municipality,email,await bcrypt.hash(password,10)])).rows[0].id;
    const login=await fetch(base+'/api/auth/login',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})
    });
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    const before=await fetch(base+'/projetos',{headers:{cookie},redirect:'manual'});
    assert.equal(before.status,200,'A sessão válida acessa tela privada');
    const logout=await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie},redirect:'manual'});
    assert.equal(logout.status,303);
    const after=await fetch(base+'/projetos',{headers:{cookie},redirect:'manual'});
    assert.ok([303,307,308].includes(after.status),'O mesmo cookie já não pode acessar dados');
    const rows=(await admin.query('SELECT revoked_at FROM user_sessions WHERE user_id=$1',[uid])).rows;
    assert.equal(rows.length,1);
    assert.ok(rows[0].revoked_at,'Sessão invalidada também no banco');
  } finally {
    if(municipality) {
      await admin.query('DELETE FROM users WHERE municipality_id=$1',[municipality]);
      await admin.query('DELETE FROM municipalities WHERE id=$1',[municipality]);
    }
    await admin.end();
  }
});

test('Expiração administrativa da sessão bloqueia JWT ainda não vencido',async()=>{
  const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
  await admin.connect();
  const suffix=randomUUID().slice(0,8);
  let municipality,uid;
  const email='expire-'+suffix+'@example.invalid',password='Expiracao-Teste-Fomento2026!';
  try{
    municipality=(await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",['Expiração Teste '+suffix])).rows[0].id;
    uid=(await admin.query("INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,'Admin Teste',$2,$3,'admin') RETURNING id",
      [municipality,email,await bcrypt.hash(password,10)])).rows[0].id;
    const login=await fetch(base+'/api/auth/login',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})
    });
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
    await admin.query("UPDATE user_sessions SET expires_at=now()-interval '1 minute' WHERE user_id=$1",[uid]);
    const after=await fetch(base+'/projetos',{headers:{cookie},redirect:'manual'});
    assert.ok([303,307,308].includes(after.status),'JWT deve ser recusado se sessão DB expirou');
  } finally {
    if(municipality) {
      await admin.query('DELETE FROM users WHERE municipality_id=$1',[municipality]);
      await admin.query('DELETE FROM municipalities WHERE id=$1',[municipality]);
    }
    await admin.end();
  }
});
