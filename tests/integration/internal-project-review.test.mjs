import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('A revisão AF-021 exige serviço e PostgreSQL descartáveis.');

test('AF-021: revisão e autorização interna com dupla aprovação e isolamento municipal',async(t)=>{
 const db=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await db.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,suffix=randomUUID().slice(0,8);
 const municipalities=[],users=[],projects=[],opportunities=[];
 const secret='Somente-Testes-Revisao-2026!';
 const passwordHash=await bcrypt.hash(secret,10);
 async function city(tag){
  const x=await db.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
    ['Revisao-'+suffix+'-'+tag]);
  municipalities.push(x.rows[0].id);return x.rows[0].id;
 }
 async function actor(tenant,name,role){
  const email='review-'+suffix+'-'+name+'@example.invalid';
  const x=await db.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
    'VALUES($1,$2,$3,$4,$5) RETURNING id',
    [tenant,'Revisor '+name,email,passwordHash,role]);
  const id=x.rows[0].id;users.push(id);
  const response=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password:secret})});
  assert.equal(response.status,200);
  return {id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function send(path,action,data,who,origin=base){
  const response=await fetch(base+path,{method:action,redirect:'manual',
   headers:{'content-type':'application/json',origin,
   ...(who?.cookie?{cookie:who.cookie}:{})},
   body:JSON.stringify(data)});
  const raw=await response.text();
  let parsed;
  try{parsed=JSON.parse(raw);}catch{parsed={error:'HTTP '+response.status+': '+raw.slice(0,160)};}
  return {status:response.status,body:parsed};
 }
 async function decide(data,who,origin=base){
  return send('/api/projects/internal-review','POST',data,who,origin);
 }
 async function view(path,who){
  const response=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});
  return {status:response.status,html:await response.text()};
 }
 const explanation='Análise documental realizada pela equipe municipal para fins de teste.';
 try{
  const tenantA=await city('A'),tenantB=await city('B');
  const requester=await actor(tenantA,'solicitante','analyst');
  const reviewer=await actor(tenantA,'tecnico','admin');
  const authorizer=await actor(tenantA,'autorizador','admin');
  const otherAnalyst=await actor(tenantA,'outro','analyst');
  const foreign=await actor(tenantB,'externo','admin');
  const projectA=(await db.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
    'VALUES($1,$2,$3) RETURNING id',[tenantA,requester.id,'Projeto para revisão '+suffix])).rows[0].id;
  projects.push(projectA);
  const projectB=(await db.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
    'VALUES($1,$2,$3) RETURNING id',[tenantB,foreign.id,'Projeto estrangeiro '+suffix])).rows[0].id;
  projects.push(projectB);
  const initial={projectId:projectA,action:'submit',expectedRevision:0,note:explanation};
  await t.test('solicitante autorizado inicia revisão; sessão, origem e município não podem ser forjados',async()=>{
   assert.equal((await decide(initial)).status,401);
   assert.equal((await decide(initial,otherAnalyst)).status,404);
   assert.equal((await decide(initial,foreign)).status,404);
   assert.equal((await decide({...initial,municipalityId:tenantB},requester)).status,400);
   assert.equal((await decide({...initial,note:'curto'},requester)).status,400);
   assert.equal((await decide({...initial,expectedRevision:-1},requester)).status,400);
   assert.equal((await decide(initial,requester,'https://invasor.invalid')).status,403);
   const created=await decide(initial,requester);
   assert.equal(created.status,200);assert.equal(created.body.revision,1);
   assert.equal((await decide(initial,requester)).status,409);
   const own=await view('/projetos/'+projectA+'/revisao',requester);
   assert.equal(own.status,200);
   assert.ok(own.html.includes('Em revisão técnica'));
   assert.ok(own.html.includes('Revisor solicitante'));
   assert.equal((await view('/projetos/'+projectA+'/revisao',foreign)).status,404);
   assert.equal((await view('/projetos/'+projectA+'/revisao')).status,307);
   assert.equal((await view('/revisoes',requester)).status,200);
   const bPage=await view('/revisoes',foreign);
   assert.equal(bPage.status,200);
   assert.ok(!bPage.html.includes('Projeto para revisão '+suffix));
  });

  await t.test('devolução preserva justificativa e reenvio incrementa a versão',async()=>{
   const returnBody={projectId:projectA,action:'return',expectedRevision:1,
    note:'Requeremos documentação complementar antes da autorização.'};
   assert.equal((await decide(returnBody,requester)).status,403);
   assert.equal((await decide(returnBody,foreign)).status,404);
   assert.equal((await decide(returnBody,reviewer)).status,200);
   assert.equal((await decide(returnBody,reviewer)).status,409);
   assert.equal((await decide({...initial,expectedRevision:1},requester)).status,409);
   const resubmitted=await decide({...initial,expectedRevision:2,
    note:'Candidatura reenviada após conferência das recomendações.'},requester);
   assert.equal(resubmitted.status,200);assert.equal(resubmitted.body.revision,3);
   assert.equal((await decide({...initial,expectedRevision:2},requester)).status,409);
   const history=await db.query('SELECT action,revision FROM project_internal_review_events '+
     'WHERE project_id=$1 ORDER BY revision',[projectA]);
   assert.deepEqual(history.rows.map(x=>x.action),['submitted','returned','resubmitted']);
   assert.deepEqual(history.rows.map(x=>x.revision),[1,2,3]);
  });

  let docId,taskId;
  await t.test('gates: checklist, pendência documental e tarefas abertas bloqueiam aprovação',async()=>{
   const technical={projectId:projectA,action:'technical_approve',expectedRevision:3,
    note:'Exame técnico completo, com justificativas e referências internas.'};
   assert.equal((await decide(technical,requester)).status,403);
   const noChecklist=await decide(technical,reviewer);
   assert.equal(noChecklist.status,409);
   assert.equal(noChecklist.body.blockers.has_checklist,false);
   const model=(await db.query(
     "INSERT INTO municipal_document_templates(municipality_id,modality,title,created_by) "+
     "VALUES($1,'convenio',$2,$3) RETURNING id",
     [tenantA,'Certidão de análise '+suffix,reviewer.id])).rows[0].id;
   const createList=await send('/api/projects/document-checklist','POST',
     {projectId:projectA,modality:'convenio'},reviewer);
   assert.equal(createList.status,201);
   const item=(await db.query('SELECT id FROM project_document_items WHERE project_id=$1',
      [projectA])).rows[0];docId=item.id;
   const pending=await decide(technical,reviewer);
   assert.equal(pending.status,409);
   assert.equal(pending.body.blockers.pending_documents,1);
   const clearDoc=await send('/api/projects/document-item','PATCH',
     {projectId:projectA,itemId:docId,status:'apresentado',evidenceNote:explanation},requester);
   assert.equal(clearDoc.status,200);
   const dept=await send('/api/secretariats','POST',
     {name:'Secretaria técnica '+suffix},reviewer);
   assert.equal(dept.status,201);
   const task=await send('/api/projects/tasks','POST',{
     projectId:projectA,secretariatId:dept.body.id,assignedTo:reviewer.id,
     title:'Conferir documentos de revisão '+suffix,details:'Verificar proposta',
     dueOn:'2027-01-10',
   },reviewer);
   assert.equal(task.status,201);taskId=task.body.id;
   const blocked=await decide(technical,reviewer);
   assert.equal(blocked.status,409);
   assert.equal(blocked.body.blockers.open_tasks,1);
   const done=await send('/api/projects/tasks/change','PATCH',{
    taskId,action:'status',expectedRevision:1,status:'concluida',
    note:'Tarefa de conferência interna encerrada com evidências.'
   },reviewer);
   assert.equal(done.status,200);
   const opp=await db.query(
    "INSERT INTO opportunities(title,provider,is_example) VALUES($1,'Fonte fictícia',true) RETURNING id",
    ['Oportunidade de revisão '+suffix]);
   opportunities.push(opp.rows[0].id);
   await db.query('UPDATE projects SET opportunity_id=$1 WHERE id=$2',[opp.rows[0].id,projectA]);
   const requirement=(await db.query(
    'INSERT INTO opportunity_requirements(municipality_id,opportunity_id,requirement,mandatory,'+
    'source_url,source_version,source_section,evidence_excerpt,created_by) '+
    'VALUES($1,$2,$3,true,$4,$5,$6,$7,$8) RETURNING id',
    [tenantA,opp.rows[0].id,'Comprovar capacidade institucional documentada '+suffix,
     'https://www.gov.br/teste','edicao-2026','Secao III',
     'Trecho fictício para simular a comprovação de capacidade institucional.',reviewer.id])).rows[0].id;
   const missing=await decide(technical,reviewer);
   assert.equal(missing.status,409);
   assert.equal(missing.body.blockers.mandatory_requirements_missing,1);
   await db.query(
    'INSERT INTO project_requirement_assessments(municipality_id,project_id,opportunity_id,'+
    'requirement_id,status,evidence_note,assessed_by) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [tenantA,projectA,opp.rows[0].id,requirement,'atendido',
     'Comprovação institucional declarada manualmente para teste.',requester.id]);
  });

  await t.test('dois administradores distintos revisam e autorizam, sem envio externo',async()=>{
   const technical={projectId:projectA,action:'technical_approve',expectedRevision:3,
    note:'Revisão técnica registrada com checklist e tarefas concluídos.'};
   const valid=await decide(technical,reviewer);
   assert.equal(valid.status,200);assert.equal(valid.body.revision,4);
   assert.equal((await decide(technical,reviewer)).status,409);
   const approve={projectId:projectA,action:'authorize',expectedRevision:4,
    note:'Autorização interna após validação independente da análise técnica.'};
   assert.equal((await decide(approve,reviewer)).status,404);
   assert.equal((await decide(approve,requester)).status,403);
   assert.equal((await decide(approve,foreign)).status,404);
   const reopened=await send('/api/projects/tasks/change','PATCH',{
    taskId,action:'status',expectedRevision:2,status:'em_andamento',
    note:'Nova conferência solicitada após conclusão da revisão técnica.'
   },reviewer);
   assert.equal(reopened.status,200);
   const blockedAuthorization=await decide(approve,authorizer);
   assert.equal(blockedAuthorization.status,409);
   assert.equal(blockedAuthorization.body.blockers.open_tasks,1);
   const completed=await send('/api/projects/tasks/change','PATCH',{
    taskId,action:'status',expectedRevision:3,status:'concluida',
    note:'Complementação final concluída antes da autorização interna.'
   },reviewer);
   assert.equal(completed.status,200);
   const auth=await decide(approve,authorizer);
   assert.equal(auth.status,200);assert.equal(auth.body.revision,5);
   assert.equal((await decide(approve,authorizer)).status,409);
   const record=(await db.query(
    'SELECT state,revision,submitted_by,technically_reviewed_by,authorized_by '+
    'FROM project_internal_reviews WHERE project_id=$1',[projectA])).rows[0];
   assert.equal(record.state,'autorizada');assert.equal(record.revision,5);
   assert.equal(record.submitted_by,requester.id);
   assert.equal(record.technically_reviewed_by,reviewer.id);
   assert.equal(record.authorized_by,authorizer.id);
   const external=(await db.query('SELECT status FROM projects WHERE id=$1',[projectA])).rows[0];
   assert.equal(external.status,'rascunho');
   const events=await db.query(
    'SELECT action,revision,actor_id FROM project_internal_review_events WHERE project_id=$1 '+
    'ORDER BY revision',[projectA]);
   assert.deepEqual(events.rows.map(x=>x.action),[
    'submitted','returned','resubmitted','technical_approved','authorized'
   ]);
   assert.deepEqual(events.rows.map(x=>x.revision),[1,2,3,4,5]);
   assert.equal(events.rows[3].actor_id,reviewer.id);
   assert.equal(events.rows[4].actor_id,authorizer.id);
   const page=await view('/projetos/'+projectA+'/revisao',authorizer);
   assert.equal(page.status,200);
   assert.ok(page.html.includes('Autorizada internamente'));
   assert.ok(page.html.includes('Revisor tecnico'));
   assert.ok(page.html.includes('Revisor autorizador'));
   assert.equal((await decide({...initial,expectedRevision:5},requester)).status,409);
  });

  await t.test('RLS protege leitura e histórico imutável; sem sessão municipal nada retorna',async()=>{
   assert.equal((await app.query('SELECT * FROM project_internal_reviews')).rowCount,0);
   assert.equal((await app.query('SELECT * FROM project_internal_review_events')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[tenantB]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[foreign.id]);
    assert.equal((await app.query('SELECT * FROM project_internal_reviews')).rowCount,0);
    await app.query('SAVEPOINT no_update');
    await assert.rejects(app.query("UPDATE project_internal_review_events SET note=$1 WHERE project_id=$2",
      ['Histórico adulterado sem permissão',projectA]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT no_update');
    await app.query('SAVEPOINT no_insert');
    await assert.rejects(app.query(
     'INSERT INTO project_internal_review_events(project_id,municipality_id,revision,action,new_state,note,actor_id) '+
     "VALUES($1,$2,6,'returned','devolvida',$3,$4)",
     [projectA,tenantA,explanation,foreign.id]),/row-level security/i);
    await app.query('ROLLBACK TO SAVEPOINT no_insert');
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(projects.length)await db.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(municipalities.length){
    await db.query('DELETE FROM municipal_secretariat_member_events WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await db.query('DELETE FROM municipal_secretariat_members WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await db.query('DELETE FROM municipal_secretariats WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await db.query('DELETE FROM municipal_document_templates WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await db.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[municipalities]);
   }
   if(opportunities.length)await db.query('DELETE FROM opportunities WHERE id=ANY($1::uuid[])',
    [opportunities]);
   if(users.length)await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(municipalities.length)await db.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',
     [municipalities]);
  }finally{await app.end();await db.end();}
 }
});
