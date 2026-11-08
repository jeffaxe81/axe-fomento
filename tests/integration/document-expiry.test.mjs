import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {todaySaoPaulo} from '../../lib/document-validity.mjs';
import {UPDATE_DOCUMENT_VALIDITY_SQL} from '../../lib/document-validity-sql.mjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||
   !process.env.DATABASE_ADMIN_URL||!process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('Teste de validade exige PostgreSQL descartável e serviço HTTP.');

test('AF-019: agenda, responsável e histórico com isolamento municipal',async(t)=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const municipalities=[],users=[],projects=[],templates=[];
 const password='Somente-Teste-Validade-2026!';
 const hash=await bcrypt.hash(password,10);
 const today=todaySaoPaulo();
 const plus=(n)=>new Date(Date.parse(today+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 async function createCity(label){
  const rows=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Validade-'+tag+'-'+label]);
  municipalities.push(rows.rows[0].id);return rows.rows[0].id;
 }
 async function createUser(tenant,label,role){
  const email='validade-'+tag+'-'+label+'@example.invalid';
  const rows=await admin.query(
   'INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id',
   [tenant,'Equipe '+label,email,hash,role]);
  const id=rows.rows[0].id;users.push(id);
  const resp=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(resp.status,200);
  return {id,tenant,cookie:resp.headers.get('set-cookie')?.split(';')[0]};
 }
 async function createProject(tenant,owner,name){
  const rows=await admin.query(
   'INSERT INTO projects(municipality_id,owner_user_id,title) VALUES($1,$2,$3) RETURNING id',
   [tenant,owner,name+' '+tag]);
  projects.push(rows.rows[0].id);return rows.rows[0].id;
 }
 async function writeValid(payload,as,origin=base){
  const resp=await fetch(base+'/api/projects/document-validity',{
   method:'PATCH',headers:{'content-type':'application/json',origin,
    ...(as?.cookie?{cookie:as.cookie}:{})},body:JSON.stringify(payload)});
  return {status:resp.status,body:await resp.json()};
 }
 async function page(path,as){
  const resp=await fetch(base+path,{redirect:'manual',headers:as?.cookie?{cookie:as.cookie}:{}});
  return {status:resp.status,body:await resp.text(),location:resp.headers.get('location')};
 }
 const note='Informação documental da equipe, conferida manualmente para teste.';
 try{
  const cityA=await createCity('A'),cityB=await createCity('B');
  const adminA=await createUser(cityA,'admin-a','admin');
  const analystA=await createUser(cityA,'analyst-a','analyst');
  const inactiveA=await createUser(cityA,'inactive-a','analyst');
  const adminB=await createUser(cityB,'admin-b','admin');
  await admin.query('UPDATE users SET active=false WHERE id=$1',[inactiveA.id]);
  const projectA=await createProject(cityA,adminA.id,'Projetos de validade A');
  const projectB=await createProject(cityB,adminB.id,'Projeto privado B');
  for(const name of ['Alvará de teste','Certidão de teste','Declaração de teste']){
   const row=await admin.query('INSERT INTO municipal_document_templates(municipality_id,modality,title,created_by) '+
    "VALUES($1,'convenio',$2,$3) RETURNING id",[cityA,name+' '+tag,adminA.id]);
   templates.push(row.rows[0].id);
  }
  const foreignTemplate=await admin.query('INSERT INTO municipal_document_templates(municipality_id,modality,title,created_by) '+
   "VALUES($1,'convenio',$2,$3) RETURNING id",[cityB,'Documento B '+tag,adminB.id]);
  templates.push(foreignTemplate.rows[0].id);
  for(const [proj,who] of [[projectA,adminA],[projectB,adminB]]){
   const resp=await fetch(base+'/api/projects/document-checklist',{method:'POST',
    headers:{origin:base,'content-type':'application/json',cookie:who.cookie},
    body:JSON.stringify({projectId:proj,modality:'convenio'})});
   assert.equal(resp.status,201);
  }
  const documentA=(await admin.query(
   'SELECT id,title FROM project_document_items WHERE project_id=$1 ORDER BY title',[projectA])).rows;
  const [doc1,doc2,doc3]=documentA;
  const docB=(await admin.query('SELECT id FROM project_document_items WHERE project_id=$1',[projectB])).rows[0];
  const root={projectId:projectA,itemId:doc1.id,validUntil:plus(5),
   renewalOwnerId:analystA.id,evidenceNote:note};

  await t.test('validação recusa acesso sem sessão, origem hostil, datas e responsáveis inválidos',async()=>{
   assert.equal((await writeValid(root)).status,401);
   assert.equal((await writeValid(root,analystA,'https://intruso.invalid')).status,403);
   assert.equal((await writeValid({...root,validUntil:'2026-02-30'},analystA)).status,400);
   assert.equal((await writeValid({...root,validUntil:'2200-01-01'},analystA)).status,400);
   assert.equal((await writeValid({...root,evidenceNote:'curto'},analystA)).status,400);
   assert.equal((await writeValid({...root,renewalOwnerId:null},analystA)).status,400);
   assert.equal((await writeValid({...root,municipalityId:cityB},analystA)).status,400);
   assert.equal((await writeValid({...root,renewalOwnerId:adminB.id},analystA)).status,404);
   assert.equal((await writeValid({...root,renewalOwnerId:inactiveA.id},analystA)).status,404);
   assert.equal((await writeValid({...root,itemId:docB.id},analystA)).status,404);
   assert.equal((await writeValid({...root,projectId:projectB},analystA)).status,404);
   assert.equal((await writeValid({...root,projectId:projectA},adminB)).status,404);
   assert.equal((await writeValid({...root,validUntil:null},analystA)).status,400);
  });

  await t.test('grava validade, atribui responsável e mantém eventos apenas para mudanças',async()=>{
   const saved=await writeValid(root,analystA);
   assert.equal(saved.status,200);assert.equal(saved.body.changed,true);
   const repeat=await writeValid(root,analystA);
   assert.equal(repeat.status,200);assert.equal(repeat.body.changed,false);
   assert.equal((await admin.query(
    'SELECT count(*)::int AS n FROM project_document_validity_events WHERE item_id=$1',
    [doc1.id])).rows[0].n,1);
   const projectPage=await page('/projetos/'+projectA+'/documentos',analystA);
   assert.equal(projectPage.status,200);
   assert.ok(projectPage.body.includes(root.validUntil.split('-').reverse().join('/')));
   assert.ok(projectPage.body.includes('Equipe analyst-a'));
   assert.ok(projectPage.body.includes(note));
   assert.ok(!projectPage.body.includes('Documento B '+tag));
   const transfer=await writeValid({...root,renewalOwnerId:adminA.id,
    evidenceNote:'A equipe transferiu a responsabilidade após conferência documental.'},adminA);
   assert.equal(transfer.status,200);assert.equal(transfer.body.changed,true);
   assert.equal((await admin.query(
    'SELECT count(*)::int AS n FROM project_document_validity_events WHERE item_id=$1',
    [doc1.id])).rows[0].n,2);
   const audit=await admin.query(
    'SELECT renewal_owner_user_id,actor_id FROM project_document_validity_events '+
    'WHERE item_id=$1 ORDER BY recorded_at,id',[doc1.id]);
   assert.deepEqual(audit.rows.map(r=>r.renewal_owner_user_id),[analystA.id,adminA.id]);
   assert.deepEqual(audit.rows.map(r=>r.actor_id),[analystA.id,adminA.id]);
  });

  await t.test('agenda filtra vencidos, 7, 30 e 90 dias e separa municípios',async()=>{
   const expiry=[
    {itemId:doc1.id,validUntil:plus(-2),owner:adminA.id},
    {itemId:doc2.id,validUntil:plus(7),owner:analystA.id},
    {itemId:doc3.id,validUntil:plus(50),owner:adminA.id},
   ];
   for(const item of expiry){
    const result=await writeValid({
     projectId:projectA,itemId:item.itemId,validUntil:item.validUntil,
     renewalOwnerId:item.owner,evidenceNote:note},adminA);
    assert.equal(result.status,200);
   }
   const foreign=await writeValid({
    projectId:projectB,itemId:docB.id,validUntil:plus(1),
    renewalOwnerId:adminB.id,evidenceNote:'Fonte documental exclusiva da prefeitura B para este teste.'},adminB);
   assert.equal(foreign.status,200);
   const p7=await page('/documentos/validade?faixa=7',analystA);
   assert.equal(p7.status,200);assert.ok(p7.body.includes('Vencido'));
   assert.ok(p7.body.includes(doc1.title));
   assert.ok(p7.body.includes(doc2.title));
   assert.ok(!p7.body.includes(doc3.title));
   assert.ok(!p7.body.includes('Documento B '+tag));
   const p30=await page('/documentos/validade?faixa=30',adminA);
   assert.equal(p30.status,200);assert.ok(!p30.body.includes(doc3.title));
   const p90=await page('/documentos/validade?faixa=90',adminA);
   assert.equal(p90.status,200);assert.ok(p90.body.includes(doc3.title));
   const expired=await page('/documentos/validade?faixa=expired',adminA);
   assert.equal(expired.status,200);
   assert.ok(expired.body.includes(doc1.title));
   assert.ok(!expired.body.includes(doc2.title));
   const other=await page('/documentos/validade?faixa=all',adminB);
   assert.equal(other.status,200);assert.ok(other.body.includes('Documento B '+tag));
   assert.ok(!other.body.includes(doc1.title));
   const anonymous=await page('/documentos/validade');
   assert.equal(anonymous.status,307);
   const all=await page('/documentos/validade?faixa=all',analystA);
   assert.ok(all.body.includes('Equipe admin-a'));
   assert.ok(all.body.includes('Equipe analyst-a'));
  });

  await t.test('remover prazo não apaga trilha nem documentos anexados',async()=>{
   const removed=await writeValid({
    projectId:projectA,itemId:doc3.id,validUntil:null,
    renewalOwnerId:null,evidenceNote:''},analystA);
   assert.equal(removed.status,200);assert.equal(removed.body.changed,true);
   const current=await admin.query(
    'SELECT valid_until,renewal_owner_user_id,validity_evidence_note FROM project_document_items WHERE id=$1',
    [doc3.id]);
   assert.equal(current.rows[0].valid_until,null);
   assert.equal(current.rows[0].renewal_owner_user_id,null);
   assert.equal(current.rows[0].validity_evidence_note,'');
   const last=await admin.query('SELECT valid_until,renewal_owner_user_id,actor_id FROM '+
    'project_document_validity_events WHERE item_id=$1 ORDER BY recorded_at DESC,id DESC LIMIT 1',
    [doc3.id]);
   assert.equal(last.rows[0].valid_until,null);
   assert.equal(last.rows[0].renewal_owner_user_id,null);
   assert.equal(last.rows[0].actor_id,analystA.id);
   assert.ok(!(await page('/documentos/validade?faixa=all',adminA)).body.includes(doc3.title));
   assert.equal((await writeValid({
    projectId:projectA,itemId:doc3.id,validUntil:null,renewalOwnerId:null,evidenceNote:''},analystA)).body.changed,false);
  });

  await t.test('RLS e FKs compostas restringem histórico e responsável ao município',async()=>{
   assert.equal((await app.query('SELECT * FROM project_document_validity_events')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[cityA]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[analystA.id]);
    const own=await app.query('SELECT * FROM project_document_validity_events');
    assert.ok(own.rowCount>=4);
    assert.ok(own.rows.every(row=>row.municipality_id===cityA));
    const forged=await app.query(UPDATE_DOCUMENT_VALIDITY_SQL,
     [cityA,projectB,docB.id,plus(30),analystA.id,note,analystA.id]);
    assert.equal(forged.rows[0].applicable,false);
    await app.query('SAVEPOINT owner_foreign');
    await assert.rejects(app.query(
     "UPDATE project_document_items SET renewal_owner_user_id=$1 WHERE id=$2",
     [adminB.id,doc1.id]),/foreign key|row-level security|violates/i);
    await app.query('ROLLBACK TO SAVEPOINT owner_foreign');
   }finally{await app.query('ROLLBACK');}
   assert.equal((await app.query('SELECT * FROM project_document_validity_events')).rowCount,0);
  });
 }finally{
  try{
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(templates.length)await admin.query('DELETE FROM municipal_document_templates WHERE id=ANY($1::uuid[])',[templates]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(municipalities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[municipalities]);
  }finally{await app.end();await admin.end();}
 }
});
