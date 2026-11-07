import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {todaySaoPaulo} from '../../lib/document-validity.mjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('AF-023 exige banco e web de testes descartáveis.');

test('AF-023: diligência por protocolo, prazo, responsável, resposta e comprovante isolados',async(t)=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const municipalities=[],users=[],projects=[];
 const password='Somente-Testes-Diligencias-2026!',passwordHash=await bcrypt.hash(password,10);
 async function municipality(label){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Diligencias '+tag+' '+label]);
  municipalities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function actor(city,label,role){
  const email='diligencias-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',[city,'Servidor '+label,email,passwordHash,role]);
  users.push(r.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(login.status,200);
  return {id:r.rows[0].id,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(city,owner,label){
  const r=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',[city,owner,'Projeto de diligencia '+label+' '+tag]);
  projects.push(r.rows[0].id);return r.rows[0].id;
 }
 async function proof(city,projectId,who,label){
  const template=(await admin.query('INSERT INTO municipal_document_templates '+
   '(municipality_id,modality,title,created_by) VALUES($1,$2,$3,$4) RETURNING id',
   [city,'convenio','Comprovante '+label+' '+tag,who.id])).rows[0].id;
  await admin.query('INSERT INTO project_document_checklists '+
   '(project_id,municipality_id,modality,created_by) VALUES($1,$2,$3,$4)',
   [projectId,city,'convenio',who.id]);
  const item=(await admin.query('INSERT INTO project_document_items '+
   '(municipality_id,project_id,modality,template_id,title,updated_by) '+
   'VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
   [city,projectId,'convenio',template,'Resposta '+label+' '+tag,who.id])).rows[0].id;
  const file=Buffer.from('%PDF-1.4\n%Documento de teste '+label+' '+tag+'\n%%EOF');
  const form=new FormData();
  form.set('projectId',projectId);form.set('itemId',item);
  form.set('note','Comprovante sintético para diligência municipal.');
  form.set('file',new Blob([file],{type:'application/pdf'}),'diligencia-'+tag+'.pdf');
  const response=await fetch(base+'/api/projects/document-attachments',{
   method:'POST',headers:{origin:base,cookie:who.cookie},body:form});
  assert.equal(response.status,201);
  const stored=(await admin.query('SELECT id,sha256 FROM project_document_versions WHERE item_id=$1',
   [item])).rows[0];
  assert.equal(stored.sha256,createHash('sha256').update(file).digest('hex'));
  return {id:stored.id,item,hash:stored.sha256};
 }
 async function call(method,path,data,who,origin=base){
  const response=await fetch(base+path,{
   method,headers:{origin,'content-type':'application/json',
    ...(who?.cookie?{cookie:who.cookie}:{})},
   body:JSON.stringify(data)});
  const raw=await response.text();
  let body;try{body=JSON.parse(raw);}catch{body={error:raw.slice(0,150)};}
  return {status:response.status,body};
 }
 async function page(path,who){
  const response=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});return {status:response.status,html:await response.text()};
 }
 try{
  const cityA=await municipality('A'),cityB=await municipality('B');
  const owner=await actor(cityA,'titular-a','analyst');
  const reviewer=await actor(cityA,'revisor-a','admin');
  const authorizer=await actor(cityA,'autorizador-a','admin');
  const outsider=await actor(cityA,'analista-nao-responsavel','analyst');
  const foreign=await actor(cityB,'administrador-b','admin');
  const proj=await project(cityA,owner.id,'principal');
  const foreignProj=await project(cityB,foreign.id,'estrangeiro');
  const foreignProof=await proof(cityB,foreignProj,foreign,'B');
  const ownProof=await proof(cityA,proj,owner,'A');
  await admin.query('INSERT INTO project_internal_reviews '+
   '(project_id,municipality_id,state,revision,submitted_by,technically_reviewed_by,'+
   'technically_reviewed_at,authorized_by,authorized_at,updated_by) '+
   "VALUES($1,$2,'autorizada',3,$3,$4,clock_timestamp(),$5,clock_timestamp(),$5)",
   [proj,cityA,owner.id,reviewer.id,authorizer.id]);
  await admin.query('INSERT INTO project_internal_review_events '+
   '(project_id,municipality_id,revision,action,previous_state,new_state,note,actor_id) '+
   "VALUES($1,$2,3,'authorized','revisada','autorizada',$3,$4)",
   [proj,cityA,'Autorização interna de teste para protocolo.',authorizer.id]);
  const protocol=await call('POST','/api/projects/external-protocols',{
   projectId:proj,reviewRevision:3,portalName:'Portal Estadual',
   portalUrl:'https://portal.exemplo.gov.br/consulta',protocolNumber:'DIL-'+tag,
   submittedOn:todaySaoPaulo(),proofVersionId:ownProof.id,
   note:'Equipe recebeu confirmação de teste no portal estadual.'
  },owner);
  assert.equal(protocol.status,201);
  const protocolId=protocol.body.id;
  const due='2026-12-10';
  const payload={projectId:proj,protocolId,assignedTo:owner.id,
   title:'Complementar comprovante '+tag,
   details:'Solicitação declarada de documentos adicionais para o protocolo.',
   dueOn:due};
  let diligenceId;
  await t.test('cadastro valida origem, titular, prefeitura, protocolo, responsável e prazo',async()=>{
   assert.equal((await call('POST','/api/projects/diligences',payload)).status,401);
   assert.equal((await call('POST','/api/projects/diligences',payload,outsider)).status,404);
   assert.equal((await call('POST','/api/projects/diligences',payload,foreign)).status,404);
   assert.equal((await call('POST','/api/projects/diligences',payload,owner,'https://bad.invalid')).status,403);
   assert.equal((await call('POST','/api/projects/diligences',
    {...payload,assignedTo:foreign.id},owner)).status,404);
   assert.equal((await call('POST','/api/projects/diligences',
    {...payload,projectId:foreignProj},authorizer)).status,404);
   assert.equal((await call('POST','/api/projects/diligences',
    {...payload,protocolId:randomUUID()},owner)).status,404);
   assert.equal((await call('POST','/api/projects/diligences',
    {...payload,dueOn:'2026-02-30'},owner)).status,400);
   assert.equal((await call('POST','/api/projects/diligences',
    {...payload,municipalityId:cityB},owner)).status,400);
   const created=await call('POST','/api/projects/diligences',payload,owner);
   assert.equal(created.status,201);diligenceId=created.body.id;
   assert.ok(diligenceId);
   const pageOwn=await page('/projetos/'+proj+'/diligencias',owner);
   assert.equal(pageOwn.status,200);
   assert.ok(pageOwn.html.includes(payload.title));
   assert.ok(pageOwn.html.includes('DIL-'+tag));
   assert.ok(pageOwn.html.includes('Servidor titular-a'));
   assert.equal((await page('/projetos/'+proj+'/diligencias',foreign)).status,404);
   assert.equal((await page('/projetos/'+proj+'/diligencias')).status,307);
  });
  await t.test('resposta exige ator correto, versão exata, revisão vigente e não duplica eventos',async()=>{
   const answer={diligenceId,expectedRevision:1,proofVersionId:ownProof.id,
    responseText:'Documentação complementar enviada externamente, conforme comprovante anexado.'};
   assert.equal((await call('PATCH','/api/projects/diligences/reply',answer)).status,401);
   assert.equal((await call('PATCH','/api/projects/diligences/reply',answer,outsider)).status,404);
   assert.equal((await call('PATCH','/api/projects/diligences/reply',answer,foreign)).status,404);
   assert.equal((await call('PATCH','/api/projects/diligences/reply',
    {...answer,proofVersionId:foreignProof.id},owner)).status,404);
   assert.equal((await call('PATCH','/api/projects/diligences/reply',
    {...answer,expectedRevision:2},owner)).status,409);
   assert.equal((await call('PATCH','/api/projects/diligences/reply',
    {...answer,responseText:'pequeno'},owner)).status,400);
   const ok=await call('PATCH','/api/projects/diligences/reply',answer,owner);
   assert.equal(ok.status,200);assert.equal(ok.body.revision,2);
   assert.equal((await call('PATCH','/api/projects/diligences/reply',answer,owner)).status,409);
   const detail=(await admin.query('SELECT state,response_text,proof_version_id,proof_sha256,'+
    'responded_by,revision FROM project_protocol_diligences WHERE id=$1',[diligenceId])).rows[0];
   assert.equal(detail.state,'respondida');
   assert.equal(detail.response_text,answer.responseText);
   assert.equal(detail.proof_version_id,ownProof.id);
   assert.equal(detail.proof_sha256,ownProof.hash);
   assert.equal(detail.responded_by,owner.id);
   assert.equal(detail.revision,2);
   const history=await admin.query('SELECT action,revision,proof_sha256 FROM '+
    'project_protocol_diligence_events WHERE diligence_id=$1 ORDER BY revision',[diligenceId]);
   assert.deepEqual(history.rows.map(x=>x.action),['criada','respondida']);
   assert.deepEqual(history.rows.map(x=>x.revision),[1,2]);
   assert.equal(history.rows[1].proof_sha256,ownProof.hash);
   const html=(await page('/projetos/'+proj+'/diligencias',owner)).html;
   assert.ok(html.includes(answer.responseText));assert.ok(html.includes(ownProof.hash));
  });
  await t.test('role limitada e FORCE RLS protegem eventos e leitura cruzada',async()=>{
   assert.equal((await app.query('SELECT * FROM project_protocol_diligences')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[cityB]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[foreign.id]);
    assert.equal((await app.query('SELECT * FROM project_protocol_diligences')).rowCount,0);
    assert.equal((await app.query('SELECT * FROM project_protocol_diligence_events')).rowCount,0);
    await app.query('SAVEPOINT lock_event');
    await assert.rejects(app.query('UPDATE project_protocol_diligence_events SET note=$1 '+
     'WHERE diligence_id=$2',['Tentativa de adulterar evento histórico.',diligenceId]),
     /permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT lock_event');
    await app.query('SAVEPOINT lock_delete');
    await assert.rejects(app.query('DELETE FROM project_protocol_diligence_events '+
     'WHERE diligence_id=$1',[diligenceId]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT lock_delete');
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(municipalities.length){
    await admin.query('DELETE FROM project_protocol_diligence_events '+
     'WHERE municipality_id=ANY($1::uuid[])',[municipalities]);
    await admin.query('DELETE FROM project_protocol_diligences '+
     'WHERE municipality_id=ANY($1::uuid[])',[municipalities]);
    await admin.query('DELETE FROM project_external_protocols '+
     'WHERE municipality_id=ANY($1::uuid[])',[municipalities]);
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(municipalities.length){
    await admin.query('DELETE FROM municipal_document_templates '+
     'WHERE municipality_id=ANY($1::uuid[])',[municipalities]);
    await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
   }
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(municipalities.length)await admin.query('DELETE FROM municipalities '+
    'WHERE id=ANY($1::uuid[])',[municipalities]);
  }finally{await app.end();await admin.end();}
 }
});
