import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import {BASELINE_CRITERIA} from '../../lib/readiness-policy.mjs';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF-041..050 requer PostgreSQL e HTTP descartáveis no CI.');

test('AF-042..050: avaliador municipal versionado, PDF, RLS e permissões',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],users=[],projects=[];
 const password='Test-Readiness-Only-'+tag+'!';
 const hash=await bcrypt.hash(password,10);
 async function city(label){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Avaliador '+tag+' '+label]);
  cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function person(m,label,role){
  const email='avaliador-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',[m,'Operador '+label,email,hash,role]);
  users.push(r.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(login.status,200);
  return {id:r.rows[0].id,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(m,owner){
  const r=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',[m,owner.id,'Projeto avaliador '+tag]);
  projects.push(r.rows[0].id);return r.rows[0].id;
 }
 async function version(m,p,actor,label){
  const template=(await admin.query('INSERT INTO municipal_document_templates '+
   '(municipality_id,modality,title,created_by) VALUES($1,$2,$3,$4) RETURNING id',
   [m,'convenio','Documento avaliador '+label+' '+tag,actor.id])).rows[0].id;
  await admin.query('INSERT INTO project_document_checklists '+
   '(project_id,municipality_id,modality,created_by) VALUES($1,$2,$3,$4)',
   [p,m,'convenio',actor.id]);
  const item=(await admin.query('INSERT INTO project_document_items '+
   '(municipality_id,project_id,modality,template_id,title,updated_by) '+
   'VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
   [m,p,'convenio',template,'Comprovante '+label+' '+tag,actor.id])).rows[0].id;
  const sample=Buffer.from('%PDF-1.4\n%Arquivo sintético '+tag+'\n%%EOF');
  const signature=createHash('sha256').update(sample).digest('hex');
  const r=await admin.query('INSERT INTO project_document_versions '+
   '(municipality_id,project_id,item_id,version,file_name,media_type,content_length,'+
   'sha256,ciphertext,nonce,auth_tag,note,uploaded_by) '+
   "VALUES($1,$2,$3,1,$4,'application/pdf',$5,$6,$7,$8,$9,$10,$11) RETURNING id",
   [m,p,item,'avaliador-'+tag+'.pdf',sample.length,signature,
    randomBytes(sample.length),randomBytes(12),randomBytes(16),
    'Arquivo sintético de validação interna.',actor.id]);
  return {id:r.rows[0].id,sha256:signature};
 }
 async function post(path,body,actor,origin=base){
  const res=await fetch(base+path,{method:'POST',headers:{origin,'content-type':'application/json',
   ...(actor?.cookie?{cookie:actor.cookie}:{})},body:JSON.stringify(body)});
  let data;try{data=await res.json();}catch{data={};}
  return {status:res.status,data};
 }
 async function get(path,actor){
  const r=await fetch(base+path,{redirect:'manual',
   headers:actor?.cookie?{cookie:actor.cookie}:{}});return r;
 }
 let a,b,adminA,analystA,adminB,projectA,projectB,versionA,versionB;
 try{
  a=await city('A');b=await city('B');
  adminA=await person(a,'admin-a','admin');
  analystA=await person(a,'analyst-a','analyst');
  adminB=await person(b,'admin-b','admin');
  projectA=await project(a,analystA);projectB=await project(b,adminB);
  versionA=await version(a,projectA,analystA,'A');
  versionB=await version(b,projectB,adminB,'B');
  const idea={kind:'idea',projectId:null,title:'Acesso a serviços comunitários '+tag,
   problem:'A população da região enfrenta longas distâncias para atendimento.',
   targetAudience:'Famílias de baixa renda da região.',
   objective:'Reduzir as barreiras de atendimento presencial com novos espaços.'};
  let ideaId,docId,rubricId,rubricV2Id,assessmentId,newAssessmentId;
  await t.test('AF-042: ideia, auth, CSRF, isolamento por município',async()=>{
   assert.equal((await post('/api/readiness/cases',idea)).status,401);
   assert.equal((await post('/api/readiness/cases',idea,analystA,'https://site.invalid')).status,403);
   assert.equal((await post('/api/readiness/cases',{...idea,title:'x'},analystA)).status,400);
   const created=await post('/api/readiness/cases',idea,analystA);
   assert.equal(created.status,201);ideaId=created.data.id;
   assert.equal((await get('/avaliador/'+ideaId,analystA)).status,200);
   assert.equal((await get('/avaliador/'+ideaId,adminB)).status,404);
   const other=(await get('/avaliador',adminB));
   assert.equal(other.status,200);assert.ok(!(await other.text()).includes(idea.title));
   assert.equal((await post('/api/readiness/cases',{...idea,kind:'documented',
    projectId:projectB},adminA)).status,404);
  });
  await t.test('AF-044: admin versiona rubrica, peso exato e optimistic concurrency',async()=>{
   const body={rubricKey:'base_'+tag,expectedVersion:0,
    criteria:BASELINE_CRITERIA,changeNote:'Primeira rubrica municipal para projeto fictício.'};
   assert.equal((await post('/api/readiness/rubrics',body,analystA)).status,403);
   assert.equal((await post('/api/readiness/rubrics',{...body,criteria:[{id:'a',label:'Apenas um',weight:90}]},adminA)).status,422);
   const first=await post('/api/readiness/rubrics',body,adminA);
   assert.equal(first.status,201);rubricId=first.data.id;
   assert.equal(first.data.version,1);
   const stale=await post('/api/readiness/rubrics',body,adminA);
   assert.equal(stale.status,409);
   const second=await post('/api/readiness/rubrics',{...body,expectedVersion:1,
    changeNote:'Segunda versão com pesos invariantes para testar histórico.'},adminA);
   assert.equal(second.status,201);rubricV2Id=second.data.id;
   assert.equal(second.data.version,2);
  });
  await t.test('AF-043: projeto documentado, prova cruzada negada, vínculo imutável',async()=>{
   const body={...idea,kind:'documented',projectId:projectA};
   const result=await post('/api/readiness/cases',body,analystA);
   assert.equal(result.status,201);docId=result.data.id;
   const invalid={caseId:docId,versionId:versionB.id,
    note:'Versão de outro município não pode ser vinculada.'};
   assert.equal((await post('/api/readiness/evidence',invalid,analystA)).status,409);
   const valid={...invalid,versionId:versionA.id};
   assert.equal((await post('/api/readiness/evidence',valid,analystA)).status,201);
   assert.equal((await post('/api/readiness/evidence',valid,analystA)).status,409);
   assert.equal((await get('/avaliador/'+docId,adminB)).status,404);
  });
  const answers=BASELINE_CRITERIA.map(c=>({id:c.id,score:95,
   evidence:'Parecer de equipe municipal '+tag+' sem comprovação externa'}));
  const blockers=[{code:'elegibilidade',evidence:'Regra objetiva do edital a conferir com publicação original.'}];
  await t.test('AF-045/046/047: nota separada de impedimentos, evidências e rubrica',async()=>{
   const body={caseId:docId,rubricId,expectedRevision:0,answers,blockers,
    revisionNote:'Avaliação v1 sustentada em evidências internas e uma ressalva.'};
   assert.equal((await post('/api/readiness/assessments',body)).status,401);
   assert.equal((await post('/api/readiness/assessments',body,adminB)).status,404);
   assert.equal((await post('/api/readiness/assessments',{...body,
    rubricId:rubricV2Id,answers:[{id:'unknown',score:100,evidence:'Inadequada'}]},analystA)).status,422);
   const done=await post('/api/readiness/assessments',body,analystA);
   assert.equal(done.status,201);assessmentId=done.data.id;
   assert.equal(Number(done.data.score),95);
   assert.equal(done.data.hasPotentialBlockers,true);
   assert.equal((await post('/api/readiness/assessments',body,analystA)).status,409);
   const [saved]=(await admin.query('SELECT score,rubric_version,revision,'+
    'jsonb_array_length(blockers_snapshot) AS nblock,'+
    'jsonb_array_length(evidence_snapshot) AS nev,'+
    'jsonb_array_length(action_plan_snapshot) AS actions, snapshot_sha256 '+
    'FROM readiness_assessments WHERE id=$1',[assessmentId])).rows;
   assert.equal(Number(saved.score),95);
   assert.equal(saved.rubric_version,1);assert.equal(saved.nblock,1);
   assert.equal(saved.nev,1);assert.ok(saved.actions>=1);
   assert.match(saved.snapshot_sha256,/^[a-f0-9]{64}$/);
   const page=(await get('/avaliador/'+docId,analystA));
   assert.equal(page.status,200);assert.ok((await page.text()).includes('95.00'));
  });
  await t.test('AF-049: reavaliação referencia versão, revisão exige outro autor',async()=>{
   const reevaluate={caseId:docId,rubricId:rubricV2Id,expectedRevision:1,
    answers,blockers,revisionNote:'Nova avaliação com rubrica v2 sem apagar v1.'};
   const saved=await post('/api/readiness/assessments',reevaluate,analystA);
   assert.equal(saved.status,201);newAssessmentId=saved.data.id;
   assert.equal(saved.data.revision,2);
   const [row]=(await admin.query('SELECT previous_id,rubric_version FROM readiness_assessments WHERE id=$1',
    [newAssessmentId])).rows;
   assert.equal(row.previous_id,assessmentId);assert.equal(row.rubric_version,2);
   const decision={assessmentId:newAssessmentId,expectedRevision:0,decision:'devolvida',
    note:'Solicitar comprovações adicionais antes da conferência editorial.'};
   assert.equal((await post('/api/readiness/reviews',decision,analystA)).status,403);
   assert.equal((await post('/api/readiness/reviews',decision,adminB)).status,404);
   assert.equal((await post('/api/readiness/reviews',{...decision,assessmentId},adminA)).status,404);
   const result=await post('/api/readiness/reviews',decision,adminA);
   assert.equal(result.status,201);
   assert.equal((await post('/api/readiness/reviews',decision,adminA)).status,409);
  });
  await t.test('AF-047: atribuição municipal auditável e concorrência',async()=>{
   const body={assessmentId:newAssessmentId,actionCode:'imp-elegibilidade',
    responsibleUserId:analystA.id,expectedRevision:0,
    justification:'Providenciar comprovação e parecer interno no prazo.'};
   assert.equal((await post('/api/readiness/actions/assign',{...body,
    responsibleUserId:adminB.id},adminA)).status,404);
   const a1=await post('/api/readiness/actions/assign',body,adminA);
   assert.equal(a1.status,201);assert.equal(a1.data.revision,1);
   assert.equal((await post('/api/readiness/actions/assign',body,adminA)).status,409);
  });
  await t.test('AF-048/050: relatório é binário PDF e não expõe outro tenant',async()=>{
   const path='/api/readiness/cases/'+docId+'/report?assessmentId='+newAssessmentId;
   assert.equal((await get(path)).status,401);
   assert.equal((await get(path,adminB)).status,404);
   const response=await get(path,analystA);
   assert.equal(response.status,200);
   assert.ok(response.headers.get('content-type')?.includes('application/pdf'));
   assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
   const [count]=(await admin.query('SELECT count(*)::integer AS n FROM readiness_assessments WHERE case_id=$1',
    [docId])).rows;
   assert.equal(count.n,2); // simulation is read-only and never creates a revision
  });
  await t.test('RLS: app role não altera evidência/rubrica/avaliação/revisão',async()=>{
   assert.equal((await app.query('SELECT * FROM readiness_assessments')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[adminB.id]);
    assert.equal((await app.query('SELECT * FROM readiness_cases WHERE id=$1',[docId])).rowCount,0);
    assert.equal((await app.query('SELECT * FROM readiness_assessments WHERE id=$1',[newAssessmentId])).rowCount,0);
    await app.query('SAVEPOINT immutable');
    await assert.rejects(app.query('UPDATE readiness_assessments SET revision_note=$1 WHERE id=$2',
     ['Alteração indevida',newAssessmentId]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT immutable');
    await app.query('SAVEPOINT immutable2');
    await assert.rejects(app.query('DELETE FROM readiness_review_events WHERE assessment_id=$1',
     [newAssessmentId]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT immutable2');
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cities.length){
    const m=[cities];
    for(const table of ['readiness_action_assignments','readiness_review_events',
     'readiness_assessments','readiness_case_evidence','readiness_rubric_versions',
     'readiness_cases','project_document_versions','project_document_items',
     'project_document_checklists','municipal_document_templates'])
     await admin.query('DELETE FROM '+table+' WHERE municipality_id=ANY($1::uuid[])',m);
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(cities.length)await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
