import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {randomUUID} from 'node:crypto';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('Testes OP-01..08 exigem PostgreSQL descartável e HTTP local');
test('V1: registro de portões OP é tenant-aware, imutável e não autoriza produção',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],users=[];
 const pass='CI-Pilot-'+tag+'-password';
 const hash=await bcrypt.hash(pass,10);
 async function addCity(name){
  const id=(await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Municipio de teste V1 '+tag+' '+name])).rows[0].id;
  cities.push(id);return id;
 }
 async function addUser(city,role,label){
  const email='piloto-'+tag+'-'+label+'@example.invalid';
  const id=(await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [city,'Gestor '+label,email,hash,role])).rows[0].id;
  users.push(id);
  const response=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password:pass})});
  assert.equal(response.status,200);
  return {id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function post(data,user,origin=base){
  return fetch(base+'/api/pilot/gates',{method:'POST',headers:{
   'content-type':'application/json',origin,...(user?.cookie?{cookie:user.cookie}:{})
  },body:JSON.stringify(data)});
 }
 const get=async(user)=>fetch(base+'/api/pilot/gates',{headers:{
  ...(user?.cookie?{cookie:user.cookie}:{})
 }});
 const payload={
  gateId:'OP-01',environmentLabel:'Staging municipal teste',
  resultClaimed:'pass',
  evidenceUrl:'https://www.gov.br/transferegov/relatorios/homologacao-ci',
  evidenceSha256:null,
  performedOn:'2026-11-06',
  notes:'Verificação sintética do CI, não é evidência de produção nem aceite formal.'
 };
 try{
  const a=await addCity('A'),b=await addCity('B');
  const userA=await addUser(a,'admin','A');
  const analyst=await addUser(a,'analyst','C');
  const userB=await addUser(b,'admin','B');
  await t.test('privacidade, autorizações e validação de prova',async()=>{
   assert.equal((await get(null)).status,401);
   assert.equal((await post(payload,null)).status,401);
   assert.equal((await post(payload,analyst)).status,403);
   assert.equal((await post(payload,userA,'https://example.invalid')).status,403);
   assert.equal((await post({...payload,evidenceUrl:'http://localhost:8080/private'},userA)).status,400);
   assert.equal((await post({...payload,performedOn:'2099-01-01'},userA)).status,400);
   assert.equal((await post({...payload,municipalityId:b},userA)).status,400);
   const inserted=await post(payload,userA);assert.equal(inserted.status,201);
   const body=await inserted.json();
   assert.equal(body.decision,'NO-GO');assert.equal(body.approved,false);
   const own=await get(userA),other=await get(userB);
   assert.equal(own.status,200);assert.equal(other.status,200);
   const aBody=await own.json(),bBody=await other.json();
   assert.equal(aBody.evidence.length,1);assert.equal(bBody.evidence.length,0);
   assert.equal(aBody.summary.independentlyApproved,0);
   assert.equal(aBody.summary.declaredPass,1);
   assert.equal(aBody.summary.decision,'NO-GO');
   assert.equal((await get(analyst)).status,200);
   const page=await fetch(base+'/evolucao',{headers:{cookie:userA.cookie}});
   assert.equal(page.status,200);const html=await page.text();
   assert.ok(html.includes('NO-GO'));assert.ok(html.includes('Staging municipal teste'));
  });
  await t.test('banco nega SELECT sem tenant e DELETE em credencial web',async()=>{
   assert.equal((await app.query('SELECT id FROM pilot_gate_evidence')).rowCount,0);
   await assert.rejects(app.query('DELETE FROM pilot_gate_evidence'),/permission denied/i);
  });
 }finally{
  try{
   if(cities.length)await admin.query('DELETE FROM pilot_gate_evidence WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
