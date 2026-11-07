import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF-042..050 exige banco PostgreSQL e aplicação descartáveis no CI.');

test('AF-042..050: ideia, rubrica, versões, nota, simulação, revisão e PDF privados',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8),cities=[],users=[],projects=[];
 const password='Axe-Fomento-CI-2026!',hash=await bcrypt.hash(password,10);
 async function city(label){
  const [r]=(await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Avaliação '+tag+' '+label])).rows;cities.push(r.id);return r.id;
 }
 async function user(tenant,label,role){
  const email='readiness-'+tag+'-'+label+'@example.invalid';
  const [r]=(await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id',
   [tenant,'Pessoa '+label,email,hash,role])).rows;users.push(r.id);
  const response=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(response.status,200);
  return {id:r.id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(tenant,person,label){
  const [r]=(await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) VALUES($1,$2,$3) RETURNING id',
   [tenant,person.id,'Projeto avaliação '+tag+' '+label])).rows;
  projects.push(r.id);return r.id;
 }
 async function post(body,person,origin=base){
  const response=await fetch(base+'/api/projects/readiness',{method:'POST',
   headers:{'content-type':'application/json',origin,
    ...(person?.cookie?{cookie:person.cookie}:{})},
   body:JSON.stringify(body)});
  const text=await response.text();let payload;
  try{payload=JSON.parse(text);}catch{payload={error:text.slice(0,150)};}
  return {status:response.status,data:payload};
 }
 async function get(path,person){
  return fetch(base+path,{redirect:'manual',headers:person?.cookie?{cookie:person.cookie}:{}});
 }
 let a,b,owner,adminA,foreign,pA,pB,documentId,budgetId,rubricId,ideaId,assessment1,assessment2;
 try{
  a=await city('A');b=await city('B');
  owner=await user(a,'owner-a','analyst');
  adminA=await user(a,'admin-a','admin');
  foreign=await user(b,'admin-b','admin');
  pA=await project(a,owner,'A');pB=await project(b,foreign,'B');
  const idea={action:'idea',projectId:pA,expectedVersion:0,
   problem:'Escassez de equipamentos comunitários no território urbano.',
   audience:'Famílias residentes em bairros atendidos pelo município.',
   objective:'Ampliar o acesso da população a serviços públicos comunitários.'};
  await t.test('AF-042: registro de ideia versionado, autenticação e isolamento',async()=>{
   assert.equal((await post(idea)).status,401);
   assert.equal((await post(idea,foreign)).status,404);
   assert.equal((await post(idea,owner,'https://agente-malicioso.invalid')).status,403);
   assert.equal((await post({...idea,municipalityId:b},owner)).status,400);
   const saved=await post(idea,owner);
   assert.equal(saved.status,201,JSON.stringify(saved.data));ideaId=saved.data.id;
   assert.ok(ideaId);
   assert.equal((await post(idea,owner)).status,409);
   assert.equal((await post({...idea,expectedVersion:1,objective:idea.objective+' Segunda revisão.'},owner)).status,201);
  });
  await t.test('AF-044: rubrica versionada exige 100 pontos e papel administrativo',async()=>{
   const rubric={action:'rubric',expectedVersion:0,note:'Critérios internos de maturidade para o teste.',
    criteria:[{id:'necessidade',label:'Demanda territorial',weight:60},
     {id:'custos',label:'Orçamento documentado',weight:40}]};
   assert.equal((await post(rubric,owner)).status,403);
   assert.equal((await post({...rubric,criteria:[{...rubric.criteria[0],weight:50},rubric.criteria[1]]},adminA)).status,400);
   const result=await post(rubric,adminA);
   assert.equal(result.status,201,JSON.stringify(result.data));rubricId=result.data.id;
   assert.ok(rubricId);
   assert.equal((await post(rubric,adminA)).status,409);
  });
  await t.test('AF-043: anexos técnicos e orçamento vinculados por fonte imutável',async()=>{
   const [template]=(await admin.query(
    'INSERT INTO municipal_document_templates(municipality_id,modality,title,created_by) VALUES($1,$2,$3,$4) RETURNING id',
    [a,'convenio','Comprovante técnico '+tag,owner.id])).rows;
   await admin.query('INSERT INTO project_document_checklists(project_id,municipality_id,modality,created_by) VALUES($1,$2,$3,$4)',
    [pA,a,'convenio',owner.id]);
   const [item]=(await admin.query('INSERT INTO project_document_items(municipality_id,project_id,modality,template_id,title,updated_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
    [a,pA,'convenio',template.id,'Documento técnico '+tag,owner.id])).rows;
   const bytes=Buffer.from('%PDF'),sha256=createHash('sha256').update(bytes).digest('hex');
   const [document]=(await admin.query(
    'INSERT INTO project_document_versions(municipality_id,project_id,item_id,version,file_name,media_type,content_length,sha256,ciphertext,nonce,auth_tag,note,uploaded_by) VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id',
    [a,pA,item.id,'prova.pdf','application/pdf',bytes.length,sha256,bytes,
     Buffer.alloc(12,1),Buffer.alloc(16,2),'Arquivo sintético de teste de evidência.',owner.id])).rows;
   documentId=document.id;
   const [stage]=(await admin.query('INSERT INTO project_budget_stages(municipality_id,project_id,stage_number,title,starts_on,ends_on,assumptions,created_by) VALUES($1,$2,1,$3,$4,$5,$6,$7) RETURNING id',
    [a,pA,'Etapa inicial '+tag,'2026-01-01','2026-12-31',
     'Valores sintéticos não representam cotação pública.',owner.id])).rows;
   const [budget]=(await admin.query(
    'INSERT INTO project_budget_items(municipality_id,project_id,stage_id,line_number,title,unit,quantity_milli,unit_cost_cents,assumptions,created_by) VALUES($1,$2,$3,1,$4,$5,1000,100000,$6,$7) RETURNING id',
    [a,pA,stage.id,'Equipamento comunitário '+tag,'un',
     'Item sintético apenas para teste de prontidão.',owner.id])).rows;
   budgetId=budget.id;
   const doc={action:'evidence',projectId:pA,kind:'document',sourceId:documentId,
    note:'Documento técnico vinculado com hash e versão fixa.'};
   assert.equal((await post({...doc,projectId:pB},owner)).status,404);
   assert.equal((await post(doc,foreign)).status,404);
   assert.equal((await post({...doc,sourceId:randomUUID()},owner)).status,404);
   assert.equal((await post(doc,owner)).status,201);
   assert.equal((await post(doc,owner)).status,409);
   assert.equal((await post({action:'evidence',projectId:pA,kind:'budget',sourceId:budgetId,
    note:'Item financeiro vinculado por identificador imutável.'},owner)).status,201);
  });
  const blockers=[{id:'legal',title:'Obrigação legal a conferir',
   ruleUrl:'https://www.gov.br/planejamento',
   evidence:'Conferência jurídica pendente de despacho formal e atualização normativa.',confirmed:true}];
  const assessments=[{id:'necessidade',score:90,evidence:'Levantamento local com critérios documentados.'},
   {id:'custos',score:null,evidence:null}];
  await t.test('AF-045/046: nota parcial, impedimento separado e revisão otimista',async()=>{
   const evaluation={action:'evaluate',projectId:pA,stage:'idea',ideaId,
    rubricId,previousId:null,expectedVersion:0,
    assessments,blockers,note:'Avaliação inicial baseada em evidências declaradas.'};
   assert.equal((await post(evaluation,foreign)).status,404);
   assert.equal((await post({...evaluation,rubricId:randomUUID()},owner)).status,404);
   const r=await post(evaluation,owner);
   assert.equal(r.status,201,JSON.stringify(r.data));assessment1=r.data.id;
   assert.equal(r.data.score,54);assert.equal(r.data.coverage,60);
   assert.equal(r.data.blockersConfirmed,1);
   assert.equal((await post(evaluation,owner)).status,409);
   const second=await post({...evaluation,stage:'documented',expectedVersion:1,
    previousId:assessment1,assessments:[
     assessments[0],{id:'custos',score:100,evidence:'Orçamento financeiro anexado e declarado.'}
    ],note:'Reavaliação de projeto documentado sem certificado externo.'},owner);
   assert.equal(second.status,201,JSON.stringify(second.data));assessment2=second.data.id;
   assert.equal(second.data.version,2);
   assert.equal(second.data.score,94);
  });
  await t.test('AF-047/048: plano de ação auditável e cenário hipotético sem mutação',async()=>{
   const assign={action:'assign',assessmentId:assessment2,actionKey:'b-legal',
    expectedRevision:0,assignedTo:owner.id,
    note:'Responsável designado para revisão da regra e evidência.'};
   assert.equal((await post(assign,foreign)).status,404);
   assert.equal((await post({...assign,assignedTo:foreign.id},owner)).status,409);
   assert.equal((await post(assign,owner)).status,201);
   assert.equal((await post(assign,owner)).status,409);
   const before=(await admin.query('SELECT count(*)::int AS n FROM project_readiness_assessments WHERE project_id=$1',[pA])).rows[0].n;
   const sim=await post({action:'simulate',assessmentId:assessment2,
    changes:[{id:'necessidade',score:100,evidence:'Hipótese de expansão com estudo público adicional.'}]},owner);
   assert.equal(sim.status,200,JSON.stringify(sim.data));
   assert.equal(sim.data.current.score,94);assert.equal(sim.data.hypothetical.score,100);
   assert.equal(sim.data.delta,6);
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM project_readiness_assessments WHERE project_id=$1',[pA])).rows[0].n,before);
  });
  await t.test('AF-049/050: revisor distinto, PDF autenticado e ficha privada',async()=>{
   const review={action:'review',assessmentId:assessment2,expectedRevision:0,
    decision:'reviewed',note:'Revisão interna concluída com lacuna legal ainda identificada.'};
   assert.equal((await post(review,owner)).status,403);
   assert.equal((await post(review,adminA)).status,201);
   assert.equal((await post(review,adminA)).status,409);
   const p=await get('/projetos/'+pA+'/avaliador',owner);
   assert.equal(p.status,200);assert.ok((await p.text()).includes('Prontidão'));
   assert.equal((await get('/projetos/'+pA+'/avaliador',foreign)).status,404);
   const url='/api/projects/readiness/report/'+assessment2;
   assert.equal((await get(url)).status,401);
   assert.equal((await get(url,foreign)).status,404);
   const pdf=await get(url,owner);
   assert.equal(pdf.status,200);
   assert.match(pdf.headers.get('content-type')??'',/application\/pdf/);
   assert.match(pdf.headers.get('cache-control')??'',/no-store/);
   assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()).slice(0,5)),'%PDF-');
  });
  await t.test('Isolamento PostgreSQL: role web não vê outros tenants nem modifica eventos',async()=>{
   assert.equal((await app.query('SELECT * FROM project_readiness_assessments')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[foreign.id]);
    assert.equal((await app.query('SELECT * FROM project_readiness_assessments WHERE project_id=$1',[pA])).rowCount,0);
    assert.equal((await app.query('SELECT * FROM readiness_review_events WHERE project_id=$1',[pA])).rowCount,0);
    await app.query('SAVEPOINT protect');
    await assert.rejects(app.query('DELETE FROM readiness_review_events WHERE assessment_id=$1',[assessment2]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT protect');
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cities.length){
    for(const table of ['readiness_action_assignment_events','readiness_review_events',
     'project_readiness_assessments','project_readiness_evidence','municipal_readiness_rubrics',
     'project_readiness_ideas','project_document_versions','project_budget_items',
     'project_budget_stages','project_document_items','project_document_checklists',
     'municipal_document_templates']){
     await admin.query('DELETE FROM '+table+' WHERE municipality_id=ANY($1::uuid[])',[cities]);
    }
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(cities.length)await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await admin.end();await app.end();}
 }
});
