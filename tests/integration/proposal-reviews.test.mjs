import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF-033 exige PostgreSQL e HTTP de CI descartáveis.');

test('AF-033: revisões humanas da versão exata, autorização, concorrência e RLS',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],users=[],projects=[];
 const password='Only-Review-CI-2026!',hash=await bcrypt.hash(password,10);
 async function city(label){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Revisão AF033 '+tag+' '+label]);cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function actor(municipality,label,role){
  const email='review-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Revisor '+label,email,hash,role]);
  users.push(r.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({email,password})});
  assert.equal(login.status,200);
  return {id:r.rows[0].id,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(municipality,who,label){
  const r=await admin.query(
   'INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',
   [municipality,who.id,'Minuta submetida à revisão '+label+' '+tag]);
  projects.push(r.rows[0].id);return r.rows[0].id;
 }
 async function api(path,body,who,origin=base){
  const res=await fetch(base+path,{method:'POST',headers:{
   origin,'content-type':'application/json',
   ...(who?.cookie?{cookie:who.cookie}:{})
  },body:JSON.stringify(body)});
  const raw=await res.text();let data;
  try{data=JSON.parse(raw);}catch{data={error:raw.slice(0,200)};}
  return {status:res.status,data};
 }
 async function page(path,who){
  const r=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});
  return {status:r.status,html:await r.text()};
 }
 try{
  const a=await city('A'),b=await city('B');
  const owner=await actor(a,'owner','analyst');
  const reviewer=await actor(a,'reviewer','admin');
  const secondReviewer=await actor(a,'second','admin');
  const outsider=await actor(a,'outsider','analyst');
  const foreign=await actor(b,'foreign','admin');
  const pA=await project(a,owner,'A');
  const pB=await project(b,foreign,'B');
  const generate=await api('/api/projects/proposals',{projectId:pA},owner);
  assert.equal(generate.status,201);
  const draftId=generate.data.draftId;
  const version1=(await admin.query(
   'SELECT id,sections,source_snapshot,missing_fields FROM project_proposal_versions '+
   'WHERE draft_id=$1 ORDER BY version',[draftId])).rows[0];
  assert.ok(version1.id);
  const path='/api/projects/proposals/reviews';
  const decision={
   projectId:pA,draftId,versionId:version1.id,
   decision:'aprovada',expectedReviewRevision:0,
   reviewNote:'A equipe municipal analisou a proposta, incluindo todas as fontes declaradas.',
   acknowledgedMissingSources:true
  };
  await t.test('autorização de revisor e trava de placeholders',async()=>{
   assert.equal((await api(path,decision)).status,401);
   assert.equal((await api(path,decision,owner)).status,403);
   assert.equal((await api(path,decision,outsider)).status,403);
   assert.equal((await api(path,decision,foreign)).status,404);
   assert.equal((await api(path,{...decision,projectId:pB},reviewer)).status,404);
   assert.equal((await api(path,{...decision,municipalityId:b},reviewer)).status,400);
   assert.equal((await api(path,{...decision,reviewerId:foreign.id},reviewer)).status,400);
   assert.equal((await api(path,{...decision,reviewNote:'curta'},reviewer)).status,400);
   assert.equal((await api(path,decision,reviewer,'https://site-malicioso.invalid')).status,403);
   assert.equal((await api(path,{...decision,acknowledgedMissingSources:false},reviewer)).status,422);
   assert.equal((await api(path,decision,reviewer)).status,422,
    'Não aprovar a versão com marcadores [PREENCHER E VALIDAR]');
   const returned=await api(path,{...decision,decision:'devolvida',
    acknowledgedMissingSources:false},reviewer);
   assert.equal(returned.status,201);
   assert.equal(returned.data.revision,1);
   assert.equal(returned.data.scope,'revisao_editorial_interna');
   assert.equal((await api(path,{...decision,decision:'devolvida'},reviewer)).status,409);
   const history=await page('/projetos/'+pA+'/proposta/revisoes/'+version1.id,owner);
   assert.equal(history.status,200);
   assert.ok(history.html.includes('data-review-revision="1"'));
   assert.ok(history.html.includes('Devolvida ao redator'));
   assert.equal((await page('/projetos/'+pB+'/proposta/revisoes/'+version1.id,foreign)).status,404);
   assert.equal((await page('/projetos/'+pA+'/proposta/revisoes/'+version1.id)).status,307);
  });
  let version2,completed;
  await t.test('nova versão editada não herda decisão e pode receber aprovação editorial',async()=>{
   const replace=(v)=>Object.fromEntries(Object.entries(v).map(([key,value])=>
    [key,value.replaceAll('[PREENCHER E VALIDAR PELA EQUIPE MUNICIPAL]',
     'Informações detalhadas pelo município para análise e validação externa.')]));
   completed=replace(version1.sections);
   const revision=await api('/api/projects/proposals/revisions',{
    projectId:pA,draftId,expectedVersion:1,sections:completed,
    revisionNote:'Correções implementadas conforme retorno do primeiro revisor.'
   },owner);
   assert.equal(revision.status,201);
   const v=(await admin.query(
    'SELECT id,version,created_by,source_snapshot,missing_fields '+
    'FROM project_proposal_versions WHERE draft_id=$1 AND version=2',[draftId])).rows[0];
   assert.equal(v.version,2);
   assert.deepEqual(v.source_snapshot,version1.source_snapshot);
   assert.deepEqual(v.missing_fields,version1.missing_fields);
   version2=v;
   const firstPage=await page('/projetos/'+pA+'/proposta',reviewer);
   assert.equal(firstPage.status,200);
   assert.ok(firstPage.html.includes('data-current-review-status="pendente"'));
   assert.ok(firstPage.html.includes('data-version="2"'));
   assert.equal((await api(path,{...decision,expectedReviewRevision:1},reviewer)).status,404,
    'Decisão para versão antiga não deve ser reaberta como vigente');
   const valid={...decision,versionId:version2.id};
   const ok=await api(path,valid,reviewer);
   assert.equal(ok.status,201);
   assert.equal(ok.data.revision,1);
   assert.equal(ok.data.decision,'aprovada');
   assert.equal((await api(path,valid,reviewer)).status,409);
   const status=await page('/projetos/'+pA+'/proposta',owner);
   assert.equal(status.status,200);
   assert.ok(status.html.includes('data-current-review-status="aprovada"'));
   assert.ok(status.html.includes('data-version="1"'));
   assert.ok(status.html.includes('Devolvida ao redator'));
   const audit=await admin.query(
    'SELECT decision,reviewer_id,acknowledged_missing_sources '+
    'FROM project_proposal_review_events WHERE version_id=$1',[version2.id]);
   assert.equal(audit.rows[0].reviewer_id,reviewer.id);
   assert.equal(audit.rows[0].acknowledged_missing_sources,true);
  });
  await t.test('revisões concorrentes preservam uma decisão por revisão',async()=>{
   const baseReview={...decision,versionId:version2.id,expectedReviewRevision:1,
    decision:'devolvida',acknowledgedMissingSources:false,
    reviewNote:'Recomendada revisão adicional antes de seguir com a proposta.'};
   const results=await Promise.all([
    api(path,baseReview,reviewer),
    api(path,{...baseReview,decision:'aprovada',acknowledgedMissingSources:true,
     reviewNote:'Conteúdo da versão conferido quanto à consistência editorial.'},secondReviewer)
   ]);
   assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
   const events=(await admin.query(
    'SELECT revision,decision,reviewer_id FROM project_proposal_review_events '+
    'WHERE version_id=$1 ORDER BY revision',[version2.id])).rows;
   assert.deepEqual(events.map(e=>e.revision),[1,2]);
   const history=await page('/projetos/'+pA+'/proposta/revisoes/'+version2.id,reviewer);
   assert.equal(history.status,200);
   assert.ok(history.html.includes('data-review-revision="1"'));
   assert.ok(history.html.includes('data-review-revision="2"'));
  });
  await t.test('revisor não aprova sua própria redação; terceira versão volta a pendente',async()=>{
   const edited=await api('/api/projects/proposals/revisions',{
    projectId:pA,draftId,expectedVersion:2,sections:completed,
    revisionNote:'Atualização editorial escrita pelo próprio administrador revisor.'
   },reviewer);
   assert.equal(edited.status,201);
   const v=(await admin.query(
    'SELECT id,created_by FROM project_proposal_versions WHERE draft_id=$1 AND version=3',
    [draftId])).rows[0];
   assert.equal(v.created_by,reviewer.id);
   const approve={...decision,versionId:v.id,expectedReviewRevision:0};
   assert.equal((await api(path,approve,reviewer)).status,404);
   assert.equal((await api(path,approve,secondReviewer)).status,201);
   const current=await page('/projetos/'+pA+'/proposta',secondReviewer);
   assert.equal(current.status,200);
   assert.ok(current.html.includes('data-version="3"'));
  });
  await t.test('FORCE RLS e append-only na role web',async()=>{
   assert.equal((await app.query('SELECT * FROM project_proposal_review_events')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[foreign.id]);
    assert.equal((await app.query(
     'SELECT * FROM project_proposal_review_events WHERE draft_id=$1',[draftId])).rowCount,0);
    for(const sql of [
     'DELETE FROM project_proposal_review_events WHERE draft_id=$1',
     "UPDATE project_proposal_review_events SET review_note='Adulterado' WHERE draft_id=$1"
    ]){
     await app.query('SAVEPOINT denied');
     await assert.rejects(app.query(sql,[draftId]),/permission denied/i);
     await app.query('ROLLBACK TO SAVEPOINT denied');
    }
   }finally{await app.query('ROLLBACK');}
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
    assert.equal((await app.query(
     'SELECT * FROM project_proposal_review_events WHERE draft_id=$1',[draftId])).rowCount,4);
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cities.length){
    await admin.query('DELETE FROM project_proposal_review_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_proposal_versions WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_proposal_drafts WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(cities.length)await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
