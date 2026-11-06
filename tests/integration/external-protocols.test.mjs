import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {todaySaoPaulo} from '../../lib/document-validity.mjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('AF-022 exige serviço e banco descartáveis.');

test('AF-022: protocolo externo versionado sem submissão, com tenant e trilha de autoria',async(t)=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,suffix=randomUUID().slice(0,8);
 const municipalities=[],users=[],projects=[];
 const secret='Somente-Testes-Protocolo-2026!',hash=await bcrypt.hash(secret,10);
 async function city(name){
  const x=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Protocolo '+suffix+' '+name]);
  municipalities.push(x.rows[0].id);return x.rows[0].id;
 }
 async function actor(municipality,label,role){
  const email='protocol-'+suffix+'-'+label+'@example.invalid';
  const x=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Equipe '+label,email,hash,role]);
  users.push(x.rows[0].id);
  const response=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password:secret})});
  assert.equal(response.status,200);
  return {id:x.rows[0].id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(municipality,owner,title){
  const x=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',
   [municipality,owner,'Projeto '+title+' '+suffix]);
  projects.push(x.rows[0].id);return x.rows[0].id;
 }
 async function proof(municipality,projectId,who,title){
  const template=(await admin.query('INSERT INTO municipal_document_templates '+
   '(municipality_id,modality,title,created_by) VALUES($1,$2,$3,$4) RETURNING id',
   [municipality,'convenio',title+' '+suffix,who.id])).rows[0].id;
  await admin.query('INSERT INTO project_document_checklists '+
   '(project_id,municipality_id,modality,created_by) VALUES($1,$2,$3,$4)',
   [projectId,municipality,'convenio',who.id]);
  const item=(await admin.query('INSERT INTO project_document_items '+
   '(municipality_id,project_id,modality,template_id,title,updated_by) '+
   'VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
   [municipality,projectId,'convenio',template,title+' '+suffix,who.id])).rows[0].id;
  const file=Buffer.from('%PDF-1.4\n%Comprovante de protocolo '+title+' '+suffix+'\n%%EOF');
  const form=new FormData();
  form.set('projectId',projectId);form.set('itemId',item);
  form.set('note','Arquivo de teste declarado como comprovante do portal.');
  form.set('file',new Blob([file],{type:'application/pdf'}),'comprovante-'+suffix+'.pdf');
  const response=await fetch(base+'/api/projects/document-attachments',{
   method:'POST',headers:{origin:base,cookie:who.cookie},body:form});
  assert.equal(response.status,201);
  const stored=(await admin.query(
   'SELECT id,sha256,ciphertext FROM project_document_versions WHERE item_id=$1',[item])).rows[0];
  assert.equal(stored.sha256,createHash('sha256').update(file).digest('hex'));
  assert.ok(!stored.ciphertext.equals(file));
  return {id:stored.id,item,file,sha256:stored.sha256};
 }
 async function authorize(municipality,projectId,requester,reviewer,authorizer){
  await admin.query('INSERT INTO project_internal_reviews '+
   '(project_id,municipality_id,state,revision,submitted_by,technically_reviewed_by,'+
   'technically_reviewed_at,authorized_by,authorized_at,updated_by) '+
   "VALUES($1,$2,'autorizada',3,$3,$4,clock_timestamp(),$5,clock_timestamp(),$5)",
   [projectId,municipality,requester.id,reviewer.id,authorizer.id]);
  await admin.query('INSERT INTO project_internal_review_events '+
   '(project_id,municipality_id,revision,action,previous_state,new_state,note,actor_id) '+
   "VALUES($1,$2,3,'authorized','revisada','autorizada',$3,$4)",
   [projectId,municipality,'Autorização interna declarada para cenário de integração.',authorizer.id]);
 }
 async function post(data,who,origin=base){
  const response=await fetch(base+'/api/projects/external-protocols',{
   method:'POST',headers:{origin,'content-type':'application/json',
    ...(who?.cookie?{cookie:who.cookie}:{})},body:JSON.stringify(data)});
  const raw=await response.text();
  let body;try{body=JSON.parse(raw);}catch{body={error:raw.slice(0,200)};}
  return {status:response.status,body};
 }
 async function page(path,who){
  const res=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});
  return {status:res.status,html:await res.text()};
 }
 const explanation='Equipe municipal confirmou a existência do recibo no portal indicado.';
 try{
  const a=await city('A'),b=await city('B');
  const owner=await actor(a,'proponente-a','analyst');
  const reviewer=await actor(a,'revisor-a','admin');
  const authorizer=await actor(a,'autorizador-a','admin');
  const outsider=await actor(a,'analista-excluido-a','analyst');
  const foreign=await actor(b,'externo-b','admin');
  const ownProject=await project(a,owner.id,'A');
  const otherProject=await project(a,outsider.id,'outro A');
  const foreignProject=await project(b,foreign.id,'B');
  const ownProof=await proof(a,ownProject,owner,'Comprovante A');
  const crossProof=await proof(a,otherProject,outsider,'Comprovante outro A');
  const foreignProof=await proof(b,foreignProject,foreign,'Comprovante B');
  await authorize(a,ownProject,owner,reviewer,authorizer);
  const originalStatus=(await admin.query('SELECT status FROM projects WHERE id=$1',[ownProject])).rows[0].status;
  const input={projectId:ownProject,reviewRevision:3,
   portalName:'Portal de Convênios',portalUrl:'https://convenios.gov.br/consulta',
   protocolNumber:'PR-'+suffix,submittedOn:todaySaoPaulo(),
   proofVersionId:ownProof.id,note:explanation};

  await t.test('autenticação, titularidade, autorização interna e prova municipal',async()=>{
   assert.equal((await post(input)).status,401);
   assert.equal((await post(input,outsider)).status,404);
   assert.equal((await post(input,foreign)).status,404);
   assert.equal((await post({...input,municipalityId:b},owner)).status,400);
   assert.equal((await post({...input,reviewRevision:2},owner)).status,404);
   assert.equal((await post({...input,projectId:otherProject},outsider)).status,404);
   assert.equal((await post({...input,proofVersionId:crossProof.id},owner)).status,404);
   assert.equal((await post({...input,proofVersionId:foreignProof.id},owner)).status,404);
   assert.equal((await post(input,owner,'https://intruso.invalid')).status,403);
   assert.equal((await post({...input,portalUrl:'http://127.0.0.1/consulta'},owner)).status,400);
   assert.equal((await post({...input,portalUrl:'https://localhost/consulta'},owner)).status,400);
   assert.equal((await post({...input,portalUrl:'https://portal.gov.br/?token=segredo'},owner)).status,400);
   assert.equal((await post({...input,protocolNumber:'x'},owner)).status,400);
   assert.equal((await post({...input,note:'curto'},owner)).status,400);
   assert.equal((await post({...input,submittedOn:'2099-01-01'},owner)).status,400);
   assert.equal((await post({...input,submittedOn:'2026-02-30'},owner)).status,400);
  });
  await t.test('protocolo registra usuário, portal, autorização e hash da prova sem alterar status do projeto',async()=>{
   const created=await post(input,owner);
   assert.equal(created.status,201);assert.ok(created.body.id);
   const same=await post(input,owner);
   assert.equal(same.status,409);
   const records=await admin.query(
    'SELECT project_id,municipality_id,review_revision,protocol_number,portal_host,'+
    'proof_version_id,proof_item_id,proof_version,proof_sha256,recorded_by '+
    'FROM project_external_protocols WHERE project_id=$1',[ownProject]);
   assert.equal(records.rowCount,1);
   const record=records.rows[0];
   assert.equal(record.municipality_id,a);
   assert.equal(record.review_revision,3);
   assert.equal(record.proof_version_id,ownProof.id);
   assert.equal(record.proof_item_id,ownProof.item);
   assert.equal(record.proof_version,1);
   assert.equal(record.proof_sha256,ownProof.sha256);
   assert.equal(record.portal_host,'convenios.gov.br');
   assert.equal(record.recorded_by,owner.id);
   assert.equal((await admin.query('SELECT status FROM projects WHERE id=$1',[ownProject])).rows[0].status,
    originalStatus);
   const ownPage=await page('/projetos/'+ownProject+'/protocolos',owner);
   assert.equal(ownPage.status,200);
   assert.ok(ownPage.html.includes(input.protocolNumber));
   assert.ok(ownPage.html.includes(ownProof.sha256));
   assert.ok(ownPage.html.includes('Baixar'));
   assert.ok(!ownPage.html.includes('Comprovante B'));
   assert.equal((await page('/projetos/'+ownProject+'/protocolos',foreign)).status,404);
   assert.equal((await page('/projetos/'+ownProject+'/protocolos')).status,307);
   const download=await fetch(base+'/api/projects/'+ownProject+'/documents/'+ownProof.item+
    '/versions/1',{headers:{cookie:owner.cookie}});
   assert.equal(download.status,200);
   assert.deepEqual(Buffer.from(await download.arrayBuffer()),ownProof.file);
  });
  await t.test('números distintos funcionam; colisões concorrentes são recusadas',async()=>{
   const number='RACE-'+suffix;
   const answers=await Promise.all([
    post({...input,protocolNumber:number},owner),
    post({...input,protocolNumber:number},reviewer),
   ]);
   assert.deepEqual(answers.map(x=>x.status).sort((x,y)=>x-y),[201,409]);
   assert.equal((await admin.query(
    'SELECT count(*)::int AS count FROM project_external_protocols WHERE protocol_number=$1',
    [number])).rows[0].count,1);
   assert.equal((await admin.query(
    'SELECT count(*)::int AS count FROM project_external_protocols WHERE project_id=$1',
    [ownProject])).rows[0].count,2);
  });
  await t.test('FORCE RLS impede vazamento e alterações de comprovantes',async()=>{
   assert.equal((await app.query('SELECT * FROM project_external_protocols')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[foreign.id]);
    assert.equal((await app.query('SELECT * FROM project_external_protocols')).rowCount,0);
    await app.query('SAVEPOINT denied_change');
    await assert.rejects(app.query('UPDATE project_external_protocols SET note=$1 WHERE project_id=$2',
     ['Tentativa indevida de edição de histórico',ownProject]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT denied_change');
    await app.query('SAVEPOINT denied_insert');
    await assert.rejects(app.query(
     'INSERT INTO project_external_protocols(municipality_id,project_id,review_revision,'+
     'portal_name,portal_url,portal_host,protocol_number,submitted_on,'+
     'proof_version_id,proof_item_id,proof_version,proof_sha256,note,recorded_by) '+
     "VALUES($1,$2,3,'Portal indevido','https://convenios.gov.br/','convenios.gov.br',"+
     "'FORGED',CURRENT_DATE,$3,$4,1,$5,$6,$7)",
     [a,ownProject,ownProof.id,ownProof.item,ownProof.sha256,explanation,foreign.id]),
     /row-level security/i);
    await app.query('ROLLBACK TO SAVEPOINT denied_insert');
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(municipalities.length){
    await admin.query('DELETE FROM project_external_protocols WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(municipalities.length){
    await admin.query('DELETE FROM municipal_document_templates WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
   }
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(municipalities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',
     [municipalities]);
  }finally{await app.end();await admin.end();}
 }
});
