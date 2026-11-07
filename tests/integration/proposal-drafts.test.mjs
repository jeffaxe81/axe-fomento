import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF-032 exige ambiente PostgreSQL e HTTP descartável.');

test('AF-032: geração com dados declarados, versões editáveis e tenant isolado',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],users=[],projects=[],opportunities=[];
 const password='Proposal-Tests-Only-2026!',hash=await bcrypt.hash(password,10);
 async function city(suffix){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Proposta sintética '+tag+' '+suffix]);cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function actor(municipality,label,role){
  const email='proposta-'+tag+'-'+label+'@example.invalid';
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
 async function project(municipality,who,label,opportunityId=null){
  const r=await admin.query(
   'INSERT INTO projects(municipality_id,owner_user_id,title,opportunity_id) '+
   'VALUES($1,$2,$3,$4) RETURNING id',
   [municipality,who.id,'Rascunho projeto '+label+' '+tag,opportunityId]);
  projects.push(r.rows[0].id);return r.rows[0].id;
 }
 async function api(path,body,who,origin=base){
  const response=await fetch(base+path,{
   method:'POST',headers:{
    origin,'content-type':'application/json',
    ...(who?.cookie?{cookie:who.cookie}:{})
   },body:JSON.stringify(body)
  });const raw=await response.text();let data;
  try{data=JSON.parse(raw);}catch{data={error:raw.slice(0,200)};}
  return {status:response.status,data};
 }
 async function page(path,who){
  const r=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});return {status:r.status,html:await r.text()};
 }
 try{
  const a=await city('A'),b=await city('B');
  const owner=await actor(a,'owner','analyst');
  const adminA=await actor(a,'admin','admin');
  const stranger=await actor(a,'stranger','analyst');
  const adminB=await actor(b,'admin-b','admin');
  const opp=(await admin.query(
   'INSERT INTO opportunities(title,provider,source_url,is_example) '+
   'VALUES($1,$2,$3,false) RETURNING id',
   ['Programa declarado '+tag,'Órgão de Teste',
    'https://example.org/edital-declarado'])).rows[0].id;
  opportunities.push(opp);
  const pA=await project(a,owner,'A',opp);
  const pB=await project(b,adminB,'B');
  const pOther=await project(a,stranger,'Outro');
  const stage=(await admin.query(
   'INSERT INTO project_budget_stages(municipality_id,project_id,stage_number,title,'+
   'starts_on,ends_on,assumptions,created_by) '+
   "VALUES($1,$2,1,'Execução municipal','2027-01-02','2027-06-30',"+
   "'Estimativa técnica sintética submetida a revisão municipal.',$3) RETURNING id",
   [a,pA,owner.id])).rows[0].id;
  await admin.query(
   'INSERT INTO project_budget_items(municipality_id,project_id,stage_id,'+
   'line_number,title,unit,quantity_milli,unit_cost_cents,assumptions,created_by) '+
   "VALUES($1,$2,$3,1,'Material escolar','un',1000,123456,"+
   "'Preços de exemplo apenas para conferência do rascunho.',$4)",
   [a,pA,stage,owner.id]);
  await admin.query(
   'INSERT INTO opportunity_requirements(municipality_id,opportunity_id,'+
   'requirement,mandatory,source_url,source_version,source_section,'+
   'evidence_excerpt,created_by) '+
   "VALUES($1,$2,'Certidão municipal atualizada',true,'https://example.org/fonte',"+
   "'retificação 1','seção 3','É necessário apresentar certidão municipal atualizada.',$3)",
   [a,opp,adminA.id]);
  const initialPath='/api/projects/proposals';
  const editPath=initialPath+'/revisions';
  let draftId,sections,snapshot,missing;
  await t.test('geração segura com referência de orçamento, requisito e lacunas',async()=>{
   assert.equal((await api(initialPath,{projectId:pA})).status,401);
   assert.equal((await api(initialPath,{projectId:pA},stranger)).status,404);
   assert.equal((await api(initialPath,{projectId:pA},adminB)).status,404);
   assert.equal((await api(initialPath,{projectId:pB},adminA)).status,404);
   assert.equal((await api(initialPath,{projectId:pA,municipalityId:b},owner)).status,400);
   assert.equal((await api(initialPath,{projectId:pA},owner,'https://attacker.invalid')).status,403);
   const ok=await api(initialPath,{projectId:pA},owner);
   assert.equal(ok.status,201);
   draftId=ok.data.draftId;assert.ok(draftId);
   assert.equal(ok.data.version,1);
   assert.ok(ok.data.missingFields.includes('edict'));
   assert.ok(ok.data.missingFields.includes('beneficiaries'));
   assert.ok(!ok.data.missingFields.includes('budget'));
   assert.ok(!ok.data.missingFields.includes('requirements'));
   assert.equal((await api(initialPath,{projectId:pA},adminA)).status,409);
   const rows=(await admin.query(
    'SELECT v.sections,v.source_snapshot,v.missing_fields,v.origin,v.version '+
    'FROM project_proposal_versions v WHERE v.draft_id=$1',[draftId])).rows;
   assert.equal(rows.length,1);
   sections=rows[0].sections;snapshot=rows[0].source_snapshot;missing=rows[0].missing_fields;
   assert.match(sections.budget,/R\$ 1.234,56/);
   assert.match(sections.requirements,/Certidão municipal atualizada/);
   assert.match(sections.justification,/PREENCHER E VALIDAR/);
   assert.equal(snapshot.budget.totalCents,'123456');
   assert.equal(snapshot.requirements.length,1);
   assert.equal(rows[0].origin,'template_from_local_data');
   const own=await page('/projetos/'+pA+'/proposta',owner);
   assert.equal(own.status,200);
   assert.ok(own.html.includes('data-version="1"'));
   assert.ok(own.html.includes('Público beneficiário'));
   assert.equal((await page('/projetos/'+pA+'/proposta',adminB)).status,404);
   assert.equal((await page('/projetos/'+pA+'/proposta')).status,307);
  });
  await t.test('edição exige titular/admin e mantém versões imutáveis',async()=>{
   const edit={projectId:pA,draftId,expectedVersion:1,
    sections:{...sections,justification:
     'Estudo municipal complementado, com beneficiários a validar em reunião formal.'},
    revisionNote:'Revisão do diagnóstico e justificativa, mantendo ressalvas.'};
   assert.equal((await api(editPath,edit)).status,401);
   assert.equal((await api(editPath,edit,stranger)).status,404);
   assert.equal((await api(editPath,edit,adminB)).status,404);
   assert.equal((await api(editPath,{...edit,projectId:pOther},adminA)).status,404);
   assert.equal((await api(editPath,{...edit,municipalityId:b},owner)).status,400);
   assert.equal((await api(editPath,{...edit,sections:{...sections,summary:'x'}},owner)).status,400);
   assert.equal((await api(editPath,{...edit,sections:{...sections,invalid:'injected'}},owner)).status,400);
   assert.equal((await api(editPath,edit,owner,'https://attacker.invalid')).status,403);
   const ok=await api(editPath,edit,owner);
   assert.equal(ok.status,201);assert.equal(ok.data.version,2);
   assert.equal((await api(editPath,edit,owner)).status,409);
   const race={...edit,expectedVersion:2,revisionNote:
    'Segunda revisão com informação complementar e auditoria.'};
   const competing=await Promise.all([api(editPath,race,owner),api(editPath,{
    ...race,sections:{...race.sections,
     objectives:'Metas sujeitas a deliberação e conferência institucional.'}
   },adminA)]);
   assert.deepEqual(competing.map(x=>x.status).sort(),[201,409]);
   const versions=(await admin.query(
    'SELECT version,sections,source_snapshot,missing_fields,origin '+
    'FROM project_proposal_versions WHERE draft_id=$1 ORDER BY version',[draftId])).rows;
   assert.deepEqual(versions.map(v=>v.version),[1,2,3]);
   assert.equal(versions[0].sections.justification,sections.justification);
   assert.deepEqual(versions[2].source_snapshot,snapshot);
   assert.deepEqual(versions[2].missing_fields,missing);
   assert.equal(versions[1].origin,'manual_revision');
   const own=await page('/projetos/'+pA+'/proposta',owner);
   assert.equal(own.status,200);
   for(const n of [1,2,3])assert.ok(own.html.includes('data-version="'+n+'"'));
   assert.ok(own.html.includes('Revisão do diagnóstico'));
  });
  await t.test('RLS impede acesso entre municípios e role web não apaga histórico',async()=>{
   assert.equal((await app.query('SELECT * FROM project_proposal_drafts')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[adminB.id]);
    assert.equal((await app.query('SELECT * FROM project_proposal_drafts WHERE id=$1',[draftId])).rowCount,0);
    assert.equal((await app.query('SELECT * FROM project_proposal_versions WHERE draft_id=$1',[draftId])).rowCount,0);
    for(const sql of [
     'DELETE FROM project_proposal_versions WHERE draft_id=$1',
     "UPDATE project_proposal_versions SET revision_note='Alterado' WHERE draft_id=$1"
    ]){
     await app.query('SAVEPOINT prevent');
     await assert.rejects(app.query(sql,[draftId]),/permission denied/i);
     await app.query('ROLLBACK TO SAVEPOINT prevent');
    }
   }finally{await app.query('ROLLBACK');}
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
    assert.equal((await app.query('SELECT * FROM project_proposal_versions WHERE draft_id=$1',
     [draftId])).rowCount,3);
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cities.length){
    await admin.query('DELETE FROM project_proposal_versions WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_proposal_drafts WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_budget_items WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_budget_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_budget_stages WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_requirement_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_requirement_assessments WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM opportunity_requirements WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(opportunities.length)await admin.query('DELETE FROM opportunities WHERE id=ANY($1::uuid[])',[opportunities]);
   if(cities.length)await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
