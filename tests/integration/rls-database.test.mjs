import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||!process.env.DATABASE_URL)
  throw new Error('Isolamento requer banco de teste descartável e duas credenciais.');

test('PostgreSQL RLS protege municípios, usuários e projetos mesmo sem filtros de aplicação',async()=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect(); await app.connect();
 let a,b,ua,ub;const suffix=randomUUID().slice(0,8);
 try {
  const [{current_user,rolsuper,rolbypassrls}]=(await app.query('SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows;
  assert.equal(current_user,'fomento_app');assert.equal(rolsuper,false);assert.equal(rolbypassrls,false);
  a=(await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",['RLS A '+suffix])).rows[0].id;
  b=(await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'RS') RETURNING id",['RLS B '+suffix])).rows[0].id;
  const pw='SenhaRlsTeste2026!'; const hash=await bcrypt.hash(pw,10);
  ua=(await admin.query("INSERT INTO users(municipality_id,full_name,email,password_hash) VALUES($1,'RLS A',$2,$3) RETURNING id",[a,'a-'+suffix+'@example.invalid',hash])).rows[0].id;
  ub=(await admin.query("INSERT INTO users(municipality_id,full_name,email,password_hash) VALUES($1,'RLS B',$2,$3) RETURNING id",[b,'b-'+suffix+'@example.invalid',hash])).rows[0].id;
  await admin.query('INSERT INTO projects(municipality_id,title,owner_user_id) VALUES($1,$2,$3),($4,$5,$6)',[a,'Projeto A '+suffix,ua,b,'Projeto B '+suffix,ub]);

  // Without context even unfiltered SELECT returns no tenant rows.
  assert.equal((await app.query('SELECT id FROM projects')).rowCount,0);
  assert.equal((await app.query('SELECT id FROM users')).rowCount,0);
  assert.equal((await app.query('SELECT id FROM municipalities')).rowCount,0);
  await assert.rejects(app.query("INSERT INTO projects(municipality_id,title) VALUES($1,'Sem contexto')",[a]),/row-level security/i);
  await assert.rejects(app.query('SELECT password_hash FROM users'),/permission denied/i);

  await app.query('BEGIN');
  await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
  assert.deepEqual((await app.query('SELECT title FROM projects')).rows.map(r=>r.title),['Projeto A '+suffix]);
  assert.deepEqual((await app.query('SELECT full_name FROM users')).rows.map(r=>r.full_name),['RLS A']);
  assert.equal((await app.query('SELECT name FROM municipalities')).rows[0].name,'RLS A '+suffix);
  assert.equal((await app.query("UPDATE projects SET title='invasao' WHERE municipality_id=$1",[b])).rowCount,0);
  assert.equal((await app.query('DELETE FROM projects WHERE municipality_id=$1',[b])).rowCount,0);
  await app.query('SAVEPOINT forged_project');
  await assert.rejects(app.query("INSERT INTO projects(municipality_id,title) VALUES($1,'forjado')",[b]),/row-level security/i);
  await app.query('ROLLBACK TO SAVEPOINT forged_project');
  await app.query('SAVEPOINT forged_owner');
  await assert.rejects(app.query("INSERT INTO projects(municipality_id,title,owner_user_id) VALUES($1,'forjado dono',$2)",[a,ub]),/foreign key/i);
  await app.query('ROLLBACK TO SAVEPOINT forged_owner');
  await app.query("INSERT INTO projects(municipality_id,title,owner_user_id) VALUES($1,'Autorizado',$2)",[a,ua]);
  await app.query('ROLLBACK');

  // Same connection, next request: local GUC is removed.
  assert.equal((await app.query('SELECT id FROM projects')).rowCount,0);
  await app.query('BEGIN');await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
  assert.deepEqual((await app.query('SELECT title FROM projects')).rows.map(r=>r.title),['Projeto B '+suffix]);
  await app.query('COMMIT');
  assert.equal((await app.query('SELECT id FROM projects')).rowCount,0);

  const login=(await app.query('SELECT id,sid FROM public.auth_login($1,$2)',['b-'+suffix+'@example.invalid',pw])).rows[0];
  assert.equal(login.id,ub);
  assert.equal((await app.query('SELECT municipality_id FROM public.auth_session_user($1::uuid,$2::uuid)',[ub,login.sid])).rows[0].municipality_id,b);
  assert.equal((await app.query('SELECT id FROM public.auth_login($1,$2)',['b-'+suffix+'@example.invalid','senha-incorreta'])).rowCount,0);
  assert.equal((await app.query('SELECT public.auth_revoke_session($1::uuid,$2::uuid)',[ub,login.sid])).rows[0].auth_revoke_session,true);
  assert.equal((await app.query('SELECT id FROM public.auth_session_user($1::uuid,$2::uuid)',[ub,login.sid])).rowCount,0);
  const audit=(await admin.query('SELECT action, municipality_id FROM audit_events WHERE municipality_id=$1',[a])).rows;
  assert.ok(audit.some(e=>e.action==='project.insert'));
  await assert.rejects(app.query('SELECT * FROM audit_events'),/permission denied/i);
 }finally{
  try{await app.query('ROLLBACK')}catch{}
  const ids=[a,b].filter(Boolean);
  if(ids.length) {
   await admin.query('DELETE FROM projects WHERE municipality_id=ANY($1::uuid[])',[ids]);
   await admin.query('DELETE FROM users WHERE municipality_id=ANY($1::uuid[])',[ids]);
   await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[ids]);
  }
  await app.end();await admin.end();
 }
});
