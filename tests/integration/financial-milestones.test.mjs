import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {todaySaoPaulo} from '../../lib/document-validity.mjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('AF-024 exige banco e aplicação descartáveis no CI.');

test('AF-024: previsão e realização de marcos financeiros isolados por prefeitura',async(t)=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],people=[],projects=[];
 const password='Somente-Testes-Financas-2026!',hash=await bcrypt.hash(password,10);
 async function city(label){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Financas '+tag+' '+label]);cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function actor(municipality,label,role){
  const email='financas-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',[municipality,'Pessoa '+label,email,hash,role]);
  people.push(r.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(login.status,200);
  return {id:r.rows[0].id,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(municipality,owner,label){
  const r=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',[municipality,owner,'Projeto '+label+' '+tag]);
  projects.push(r.rows[0].id);return r.rows[0].id;
 }
 async function proof(municipality,projectId,who,label){
  const template=(await admin.query('INSERT INTO municipal_document_templates '+
   '(municipality_id,modality,title,created_by) VALUES($1,$2,$3,$4) RETURNING id',
   [municipality,'convenio','Comprovante '+label+' '+tag,who.id])).rows[0].id;
  await admin.query('INSERT INTO project_document_checklists '+
   '(project_id,municipality_id,modality,created_by) VALUES($1,$2,$3,$4)',
   [projectId,municipality,'convenio',who.id]);
  const item=(await admin.query('INSERT INTO project_document_items '+
   '(municipality_id,project_id,modality,template_id,title,updated_by) '+
   'VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
   [municipality,projectId,'convenio',template,'Prova '+label+' '+tag,who.id])).rows[0].id;
  const file=Buffer.from('%PDF-1.4\n%Comprovante de marco '+label+' '+tag+'\n%%EOF');
  const form=new FormData();
  form.set('projectId',projectId);form.set('itemId',item);
  form.set('note','Arquivo sintético para acompanhamento financeiro.');
  form.set('file',new Blob([file],{type:'application/pdf'}),'financeiro-'+tag+'.pdf');
  const response=await fetch(base+'/api/projects/document-attachments',{
   method:'POST',headers:{origin:base,cookie:who.cookie},body:form});
  assert.equal(response.status,201);
  const [row]=(await admin.query('SELECT id,sha256,version FROM project_document_versions '+
   'WHERE item_id=$1',[item])).rows;
  assert.equal(row.sha256,createHash('sha256').update(file).digest('hex'));
  return {id:row.id,item,sha256:row.sha256,version:row.version};
 }
 async function api(method,path,body,person,origin=base){
  const response=await fetch(base+path,{method,headers:{
   origin,'content-type':'application/json',...(person?.cookie?{cookie:person.cookie}:{})
  },body:JSON.stringify(body)});
  const raw=await response.text();let payload;
  try{payload=JSON.parse(raw);}catch{payload={error:raw.slice(0,160)};}
  return {status:response.status,body:payload};
 }
 async function page(path,person){
  const r=await fetch(base+path,{redirect:'manual',
   headers:person?.cookie?{cookie:person.cookie}:{}});return {status:r.status,html:await r.text()};
 }
 try{
  const a=await city('A'),b=await city('B');
  const owner=await actor(a,'titular-a','analyst');
  const reviewer=await actor(a,'revisor-a','admin');
  const approver=await actor(a,'aprovador-a','admin');
  const outsider=await actor(a,'terceiro-a','analyst');
  const foreign=await actor(b,'admin-b','admin');
  const projectA=await project(a,owner.id,'A');
  const projectB=await project(b,foreign.id,'B');
  const ownProof=await proof(a,projectA,owner,'A');
  const foreignProof=await proof(b,projectB,foreign,'B');
  await admin.query('INSERT INTO project_internal_reviews '+
   '(project_id,municipality_id,state,revision,submitted_by,technically_reviewed_by,'+
   'technically_reviewed_at,authorized_by,authorized_at,updated_by) '+
   "VALUES($1,$2,'autorizada',3,$3,$4,clock_timestamp(),$5,clock_timestamp(),$5)",
   [projectA,a,owner.id,reviewer.id,approver.id]);
  await admin.query('INSERT INTO project_internal_review_events '+
   '(project_id,municipality_id,revision,action,previous_state,new_state,note,actor_id) '+
   "VALUES($1,$2,3,'authorized','revisada','autorizada',$3,$4)",
   [projectA,a,'Autorização interna registrada somente para teste.',approver.id]);
  const protocol=await api('POST','/api/projects/external-protocols',{
   projectId:projectA,reviewRevision:3,portalName:'Portal de Convênios',
   portalUrl:'https://portal.exemplo.gov.br/consulta',protocolNumber:'FIN-'+tag,
   submittedOn:todaySaoPaulo(),proofVersionId:ownProof.id,
   note:'Equipe municipal conferiu recibo sintético no portal informado.'
  },owner);
  assert.equal(protocol.status,201);
  const path='/api/projects/financial-milestones';
  const realize=path+'/realize';
  const plan={projectId:projectA,protocolId:protocol.body.id,kind:'repasse',
   title:'Primeiro repasse '+tag,plannedOn:'2026-12-10',
   plannedAmount:'123456,78',
   note:'Previsão declarada para validação interna, sem comprovação de depósito.'};
  let milestoneId;
  await t.test('autorização, datas, valores e isolamento do protocolo',async()=>{
   assert.equal((await api('POST',path,plan)).status,401);
   assert.equal((await api('POST',path,plan,outsider)).status,404);
   assert.equal((await api('POST',path,plan,foreign)).status,404);
   assert.equal((await api('POST',path,plan,owner,'https://site.invalid')).status,403);
   assert.equal((await api('POST',path,{...plan,municipalityId:b},owner)).status,400);
   assert.equal((await api('POST',path,{...plan,protocolId:randomUUID()},owner)).status,404);
   assert.equal((await api('POST',path,{...plan,projectId:projectB},approver)).status,404);
   assert.equal((await api('POST',path,{...plan,plannedOn:'2026-02-30'},owner)).status,400);
   assert.equal((await api('POST',path,{...plan,plannedAmount:'1.234,56'},owner)).status,400);
   assert.equal((await api('POST',path,{...plan,plannedAmount:'0'},owner)).status,400);
   const created=await api('POST',path,plan,owner);
   assert.equal(created.status,201);milestoneId=created.body.id;
   assert.ok(milestoneId);
   const ownPage=await page('/projetos/'+projectA+'/financeiro',owner);
   assert.equal(ownPage.status,200);
   assert.ok(ownPage.html.includes(plan.title));
   assert.ok(ownPage.html.includes('R$ 123.456,78'));
   assert.equal((await page('/projetos/'+projectA+'/financeiro',foreign)).status,404);
   assert.equal((await page('/projetos/'+projectA+'/financeiro')).status,307);
  });
  await t.test('realização exige prova do mesmo projeto e versão exata; evento imutável',async()=>{
   const answer={milestoneId,expectedRevision:1,realizedOn:todaySaoPaulo(),
    realizedAmount:'123450,05',proofVersionId:ownProof.id,
    note:'Valor realizado declarado pela equipe com comprovante de teste anexado.'};
   assert.equal((await api('PATCH',realize,answer)).status,401);
   assert.equal((await api('PATCH',realize,answer,outsider)).status,404);
   assert.equal((await api('PATCH',realize,answer,foreign)).status,404);
   assert.equal((await api('PATCH',realize,
    {...answer,proofVersionId:foreignProof.id},owner)).status,404);
   assert.equal((await api('PATCH',realize,
    {...answer,realizedOn:'2099-12-31'},owner)).status,400);
   assert.equal((await api('PATCH',realize,
    {...answer,realizedAmount:'1.234,56'},owner)).status,400);
   assert.equal((await api('PATCH',realize,
    {...answer,expectedRevision:2},owner)).status,400);
   const done=await api('PATCH',realize,answer,owner);
   assert.equal(done.status,200);assert.equal(done.body.revision,2);
   assert.equal((await api('PATCH',realize,answer,owner)).status,409);
   const [row]=(await admin.query('SELECT status,planned_amount_cents,realized_amount_cents,'+
    'proof_sha256,proof_version_id,revision FROM project_financial_milestones WHERE id=$1',
    [milestoneId])).rows;
   assert.equal(row.status,'realizado');assert.equal(row.planned_amount_cents,'12345678');
   assert.equal(row.realized_amount_cents,'12345005');
   assert.equal(row.proof_sha256,ownProof.sha256);
   assert.equal(row.proof_version_id,ownProof.id);assert.equal(row.revision,2);
   const events=await admin.query('SELECT action,revision,amount_cents,proof_sha256 '+
    'FROM project_financial_milestone_events WHERE milestone_id=$1 ORDER BY revision',
    [milestoneId]);
   assert.deepEqual(events.rows.map(x=>x.action),['planned','realized']);
   assert.deepEqual(events.rows.map(x=>x.revision),[1,2]);
   assert.equal(events.rows[1].amount_cents,'12345005');
   assert.equal(events.rows[1].proof_sha256,ownProof.sha256);
   const html=(await page('/projetos/'+projectA+'/financeiro',owner)).html;
   assert.ok(html.includes('R$ 123.450,05'));
   assert.ok(html.includes(ownProof.sha256));
  });
  await t.test('marcos sem transferência financeira não inflacionam valores',async()=>{
   const free={...plan,kind:'marco',title:'Etapa física concluída '+tag,
    plannedAmount:'0,00'};
   assert.equal((await api('POST',path,free,approver)).status,201);
   assert.equal((await admin.query("SELECT count(*)::int AS n FROM project_financial_milestones "+
    "WHERE project_id=$1 AND kind='marco' AND planned_amount_cents=0",
    [projectA])).rows[0].n,1);
  });
  await t.test('FORCE RLS e permissões mínimas bloqueiam alteração de trilha',async()=>{
   assert.equal((await app.query('SELECT * FROM project_financial_milestones')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[foreign.id]);
    assert.equal((await app.query('SELECT * FROM project_financial_milestones')).rowCount,0);
    assert.equal((await app.query('SELECT * FROM project_financial_milestone_events')).rowCount,0);
    await app.query('SAVEPOINT denied_update');
    await assert.rejects(app.query('UPDATE project_financial_milestone_events SET note=$1 '+
     'WHERE milestone_id=$2',['Alteração indevida de evento',milestoneId]),
     /permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT denied_update');
    await app.query('SAVEPOINT denied_delete');
    await assert.rejects(app.query('DELETE FROM project_financial_milestone_events WHERE milestone_id=$1',
     [milestoneId]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT denied_delete');
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cities.length){
    await admin.query('DELETE FROM project_financial_milestone_events '+
     'WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_financial_milestones '+
     'WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM project_external_protocols '+
     'WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(cities.length){
    await admin.query('DELETE FROM municipal_document_templates '+
     'WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(people.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[people]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
