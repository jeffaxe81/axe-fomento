import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('AF-029 exige PostgreSQL e servidor HTTP descartáveis no CI.');

test('AF-029: modalidade, versão normativa vinculada, revisão humana e isolamento',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],people=[],projects=[],norms=[];
 const password='Modality-Tests-Only-2026!',hash=await bcrypt.hash(password,10);
 async function city(label){
  const x=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Enquadramento '+tag+' '+label]);cities.push(x.rows[0].id);return x.rows[0].id;
 }
 async function actor(municipality,label,role){
  const email='modality-'+tag+'-'+label+'@example.invalid';
  const x=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Revisor '+label,email,hash,role]);people.push(x.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{
   'content-type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(login.status,200);
  return {id:x.rows[0].id,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(municipality,owner,label){
  const x=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',[municipality,owner,'Projeto '+label+' '+tag]);
  projects.push(x.rows[0].id);return x.rows[0].id;
 }
 async function normative(municipality,who,label){
  const x=await admin.query('INSERT INTO municipal_normative_sources '+
   '(municipality_id,reference_code,title,jurisdiction,created_by) '+
   "VALUES($1,$2,$3,'federal',$4) RETURNING id",
   [municipality,'LEI '+tag.toUpperCase()+' '+label,'Fonte sintética '+tag,who.id]);
  norms.push(x.rows[0].id);
  const v=await admin.query('INSERT INTO municipal_normative_versions '+
   '(municipality_id,source_id,version,source_url,published_on,valid_from,'+
   'source_section,excerpt,context_note,snapshot_sha256,created_by) '+
   "VALUES($1,$2,1,'https://www.gov.br/norma/teste','2026-01-01',"+
   "'2026-02-01','art. 3',"+
   "'Dispositivo sintético para avaliação de projeto municipal.',"+
   "'Uso apenas em ambiente descartável com evidência declarada.',"+
   "encode(digest('vector'||$2::text,'sha256'),'hex'),$3) RETURNING id",
   [municipality,x.rows[0].id,who.id]);
  return v.rows[0].id;
 }
 async function api(path,payload,who,origin=base){
  const response=await fetch(base+path,{method:'POST',headers:{
   origin,'content-type':'application/json',...(who?.cookie?{cookie:who.cookie}:{})
  },body:JSON.stringify(payload)});
  const raw=await response.text();let result;
  try{result=JSON.parse(raw);}catch{result={error:raw.slice(0,200)};}
  return {status:response.status,result};
 }
 async function page(path,who){
  const r=await fetch(base+path,{redirect:'manual',headers:who?.cookie?
   {cookie:who.cookie}:{}});return {status:r.status,html:await r.text()};
 }
 try{
  const a=await city('A'),b=await city('B');
  const owner=await actor(a,'owner','analyst');
  const adminA=await actor(a,'admin','admin');
  const outsider=await actor(a,'outsider','analyst');
  const adminB=await actor(b,'admin-b','admin');
  const pA=await project(a,owner.id,'A');
  const pOther=await project(a,outsider.id,'Outro');
  const pB=await project(b,adminB.id,'B');
  const vA=await normative(a,adminA,'A');
  const vB=await normative(b,adminB,'B');
  const createPath='/api/projects/modality-map';
  const reviewPath=createPath+'/review';
  const input={projectId:pA,modality:'convenio',ruleNumber:1,
   criterion:'Verificar requisitos técnicos para a modalidade convenial.',
   normativeVersionId:vA};
  let checkId;
  await t.test('cadastro é pendente e exige versão normativa do mesmo município',async()=>{
   assert.equal((await api(createPath,input)).status,401);
   assert.equal((await api(createPath,input,outsider)).status,404);
   assert.equal((await api(createPath,input,adminB)).status,404);
   assert.equal((await api(createPath,input,owner,'https://phishing.invalid')).status,403);
   assert.equal((await api(createPath,{...input,municipalityId:b},owner)).status,400);
   assert.equal((await api(createPath,{...input,normativeVersionId:vB},owner)).status,404);
   assert.equal((await api(createPath,{...input,projectId:pB},adminA)).status,404);
   assert.equal((await api(createPath,{...input,modality:'another'},owner)).status,400);
   assert.equal((await api(createPath,{...input,criterion:'curto'},owner)).status,400);
   assert.equal((await api(createPath,{...input,ruleNumber:201},owner)).status,400);
   const ok=await api(createPath,input,owner);
   assert.equal(ok.status,201);assert.equal(ok.result.revision,1);
   checkId=ok.result.id;assert.ok(checkId);
   assert.equal((await api(createPath,input,adminA)).status,409);
   const rows=(await admin.query(
    'SELECT c.id,c.normative_version_id,c.normative_version,e.status,e.revision '+
    'FROM project_modality_checks c JOIN project_modality_review_events e '+
    'ON e.check_id=c.id WHERE c.id=$1',[checkId])).rows;
   assert.equal(rows.length,1);
   assert.equal(rows[0].normative_version_id,vA);
   assert.equal(rows[0].normative_version,1);
   assert.equal(rows[0].status,'pendente');
   assert.equal(rows[0].revision,1);
   const own=await page('/projetos/'+pA+'/enquadramento',owner);
   assert.equal(own.status,200);
   assert.ok(own.html.includes(input.criterion));
   assert.ok(own.html.includes('Pendente de avaliação'));
   assert.equal((await page('/projetos/'+pA+'/enquadramento',adminB)).status,404);
   assert.equal((await page('/projetos/'+pA+'/enquadramento')).status,307);
  });
  await t.test('revisões preservam eventos e detectam concorrência',async()=>{
   const update={projectId:pA,checkId,expectedRevision:1,status:'atendido',
    justification:'Documentação municipal revisada por responsável com fonte indicada.'};
   assert.equal((await api(reviewPath,update)).status,401);
   assert.equal((await api(reviewPath,update,outsider)).status,404);
   assert.equal((await api(reviewPath,update,adminB)).status,404);
   assert.equal((await api(reviewPath,{...update,projectId:pOther},adminA)).status,404);
   assert.equal((await api(reviewPath,{...update,checkId:randomUUID()},adminA)).status,404);
   assert.equal((await api(reviewPath,{...update,justification:'curto'},owner)).status,400);
   assert.equal((await api(reviewPath,{...update,expectedRevision:2},owner)).status,409);
   assert.equal((await api(reviewPath,{...update,municipalityId:b},owner)).status,400);
   assert.equal((await api(reviewPath,update,owner,'https://phishing.invalid')).status,403);
   const first=await api(reviewPath,update,owner);
   assert.equal(first.status,201);assert.equal(first.result.revision,2);
   assert.equal((await api(reviewPath,update,owner)).status,409);
   const collision={...update,expectedRevision:2,status:'nao_atendido',
    justification:'Outro revisor encontrou pendência ainda não solucionada no projeto.'};
   const race=await Promise.all([api(reviewPath,collision,owner),api(reviewPath,{
    ...collision,status:'nao_aplicavel',justification:'Justificativa alternativa para caso de revisão concorrente.'
   },adminA)]);
   assert.deepEqual(race.map(x=>x.status).sort(),[201,409]);
   const events=(await admin.query('SELECT revision,status,justification FROM '+
    'project_modality_review_events WHERE check_id=$1 ORDER BY revision',[checkId])).rows;
   assert.deepEqual(events.map(e=>e.revision),[1,2,3]);
   assert.equal(events[0].status,'pendente');
   assert.equal(events[1].status,'atendido');
   assert.equal(events[2].status!=='atendido',true);
   const history=await page('/projetos/'+pA+'/enquadramento/'+checkId,owner);
   assert.equal(history.status,200);
   assert.ok(history.html.includes('data-revision="1"'));
   assert.ok(history.html.includes('data-revision="2"'));
   assert.ok(history.html.includes('data-revision="3"'));
   assert.ok(history.html.includes('Documentação municipal revisada'));
   assert.equal((await page('/projetos/'+pB+'/enquadramento/'+checkId,adminB)).status,404);
  });
  await t.test('RLS protege leitura e role web não pode editar/apagar histórico',async()=>{
   assert.equal((await app.query('SELECT * FROM project_modality_checks')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[adminB.id]);
    assert.equal((await app.query('SELECT * FROM project_modality_checks')).rowCount,0);
    assert.equal((await app.query('SELECT * FROM project_modality_review_events')).rowCount,0);
    for(const [sql,params] of [
     ['UPDATE project_modality_checks SET criterion=$1 WHERE id=$2',
      ['Regra adulterada por outro município',checkId]],
     ['DELETE FROM project_modality_review_events WHERE check_id=$1',[checkId]]
    ]){
     await app.query('SAVEPOINT block');
     await assert.rejects(app.query(sql,params),/permission denied/i);
     await app.query('ROLLBACK TO SAVEPOINT block');
    }
   }finally{await app.query('ROLLBACK');}
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
    assert.equal((await app.query('SELECT * FROM project_modality_checks '+
     'WHERE id=$1',[checkId])).rowCount,1);
    assert.equal((await app.query('SELECT * FROM project_modality_review_events '+
     'WHERE check_id=$1',[checkId])).rowCount,3);
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cities.length){
    await admin.query('DELETE FROM project_modality_review_events '+
     'WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_modality_checks '+
     'WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(projects.length)
    await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(norms.length){
    await admin.query('DELETE FROM municipal_normative_versions '+
     'WHERE source_id=ANY($1::uuid[])',[norms]);
    await admin.query('DELETE FROM municipal_normative_sources '+
     'WHERE id=ANY($1::uuid[])',[norms]);
   }
   if(cities.length)
    await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(people.length)
    await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[people]);
   if(cities.length)
    await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
