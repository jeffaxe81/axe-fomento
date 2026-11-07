import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {encryptAttachment} from '../../lib/private-attachments.mjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('AF-030 exige ambiente descartável PostgreSQL + HTTP de CI.');

test('AF-030: PDF versionado, sugestão com origem, pendência e revisão humana isolada',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cityIds=[],userIds=[],projectIds=[],templateIds=[];
 const password='Only-CI-Assisted-Edict-2026!',hash=await bcrypt.hash(password,10);
 async function city(label){
  const q=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Edital sintético '+tag+' '+label]);
  cityIds.push(q.rows[0].id);return q.rows[0].id;
 }
 async function actor(municipality,label,role){
  const email='edital-'+tag+'-'+label+'@example.invalid';
  const q=await admin.query(
   'INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Análise '+label,email,hash,role]);
  userIds.push(q.rows[0].id);
  const response=await fetch(base+'/api/auth/login',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({email,password})});
  assert.equal(response.status,200);
  return {id:q.rows[0].id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(municipality,owner,label){
  const q=await admin.query(
   'INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',[municipality,owner,'Projeto edital '+label+' '+tag]);
  projectIds.push(q.rows[0].id);return q.rows[0].id;
 }
 async function documentVersion(municipality,projectId,who,label){
  const tpl=await admin.query(
   'INSERT INTO municipal_document_templates(municipality_id,modality,title,created_by) '+
   "VALUES($1,'convenio',$2,$3) RETURNING id",
   [municipality,'Documento original '+label+' '+tag,who.id]);
  templateIds.push(tpl.rows[0].id);
  await admin.query('INSERT INTO project_document_checklists '+
   "(project_id,municipality_id,modality,created_by) VALUES($1,$2,'convenio',$3)",
   [projectId,municipality,who.id]);
  const item=await admin.query(
   'INSERT INTO project_document_items '+
   '(municipality_id,project_id,modality,template_id,title,updated_by,current_version) '+
   "VALUES($1,$2,'convenio',$3,$4,$5,1) RETURNING id",
   [municipality,projectId,tpl.rows[0].id,'PDF do edital '+tag,who.id]);
  const file=Buffer.from('%PDF-1.4\n%synthetic only '+tag+'\n%%EOF');
  const encrypted=encryptAttachment(file,
   municipality+':'+projectId+':'+item.rows[0].id);
  const version=await admin.query(
   'INSERT INTO project_document_versions '+
   '(municipality_id,project_id,item_id,version,file_name,media_type,'+
   'content_length,sha256,ciphertext,nonce,auth_tag,note,uploaded_by) '+
   "VALUES($1,$2,$3,1,$4,'application/pdf',$5,$6,$7,$8,$9,$10,$11) RETURNING id",
   [municipality,projectId,item.rows[0].id,'edital-'+tag+'.pdf',
    file.length,encrypted.sha256,encrypted.ciphertext,encrypted.nonce,
    encrypted.authTag,'Documento de teste, sem conteúdo oficial.',who.id]);
  return {id:version.rows[0].id,itemId:item.rows[0].id};
 }
 async function api(path,body,who,origin=base){
  const response=await fetch(base+path,{method:'POST',headers:{
   origin,'content-type':'application/json',
   ...(who?.cookie?{cookie:who.cookie}:{})
  },body:JSON.stringify(body)});
  const raw=await response.text();let data;
  try{data=JSON.parse(raw);}catch{data={error:raw.slice(0,200)};}
  return {status:response.status,data};
 }
 async function page(path,who){
  const response=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});return {
   status:response.status,html:await response.text()};
 }
 try {
  const a=await city('A'),b=await city('B');
  const owner=await actor(a,'titular','analyst');
  const adminA=await actor(a,'admin','admin');
  const outsider=await actor(a,'terceiro','analyst');
  const adminB=await actor(b,'admin-b','admin');
  const pA=await project(a,owner.id,'A');
  const pOther=await project(a,outsider.id,'Outro');
  const pB=await project(b,adminB.id,'B');
  const version=await documentVersion(a,pA,owner,'A');
  const foreign=await documentVersion(b,pB,adminB,'B');
  const createPath='/api/projects/edict-extractions';
  const reviewPath=createPath+'/reviews';
  const sourceText='PÁGINA 2\n'+
   'O responsável deverá apresentar a documentação municipal exigida.\n'+
   'PÁGINA 4\n'+
   'É obrigatório comprovar a contrapartida prevista.\n'+
   'Deve entregar\n';
  const input={
   projectId:pA,documentVersionId:version.id,sourceText,
   note:'Transcrição humana do PDF sintético para conferência de requisitos.'
  };
  let batchId,suggestions;
  await t.test('controle de acesso, origem e cadastro atômico',async()=>{
   assert.equal((await api(createPath,input)).status,401);
   assert.equal((await api(createPath,input,outsider)).status,404);
   assert.equal((await api(createPath,input,adminB)).status,404);
   assert.equal((await api(createPath,input,owner,'https://attacker.invalid')).status,403);
   assert.equal((await api(createPath,{...input,municipalityId:b},owner)).status,400);
   assert.equal((await api(createPath,{...input,projectId:pOther},adminA)).status,404);
   assert.equal((await api(createPath,{...input,documentVersionId:foreign.id},owner)).status,404);
   assert.equal((await api(createPath,{...input,sourceText:'Esta seção descreve somente informações do programa e seus objetivos gerais'},owner)).status,422);
   assert.equal((await api(createPath,{...input,sourceText:'x'.repeat(16001)},owner)).status,400);
   const ok=await api(createPath,input,owner);
   assert.equal(ok.status,201);
   assert.equal(ok.data.candidates,3);
   assert.equal(ok.data.evidenceMissing,1);
   assert.equal(ok.data.method,'heuristic_from_user_text');
   batchId=ok.data.batchId;assert.ok(batchId);
   const batches=(await admin.query(
    'SELECT input_sha256,input_length,suggestion_count,document_version_id,'+
    'method FROM project_edict_extraction_batches WHERE id=$1',[batchId])).rows;
   assert.equal(batches.length,1);
   assert.equal(batches[0].document_version_id,version.id);
   assert.equal(batches[0].suggestion_count,3);
   assert.match(batches[0].input_sha256,/^[a-f0-9]{64}$/);
   assert.equal(batches[0].method,'heuristic_from_user_text');
   suggestions=(await admin.query(
    'SELECT id,seq,source_page,source_excerpt,evidence_state,suggested_requirement '+
    'FROM project_edict_suggestions WHERE batch_id=$1 ORDER BY seq',[batchId])).rows;
   assert.equal(suggestions.length,3);
   assert.deepEqual(suggestions.map(s=>s.source_page),[2,4,4]);
   assert.equal(suggestions[0].source_excerpt,
    'O responsável deverá apresentar a documentação municipal exigida.');
   assert.equal(suggestions[2].source_excerpt,null);
   assert.equal(suggestions[2].evidence_state,'missing');
   const own=await page('/projetos/'+pA+'/extracao-edital?lote='+batchId,owner);
   assert.equal(own.status,200);
   assert.ok(own.html.includes('data-suggestion="1"'));
   assert.ok(own.html.includes('data-suggestion="3"'));
   assert.ok(own.html.includes('Pendente de revisão'));
   assert.equal((await page('/projetos/'+pA+'/extracao-edital',adminB)).status,404);
   assert.equal((await page('/projetos/'+pA+'/extracao-edital')).status,307);
  });
  await t.test('sem evidência não aprova; revisão humana e concorrência preservam histórico',async()=>{
   const missing={projectId:pA,suggestionId:suggestions[2].id,
    expectedRevision:0,decision:'aprovada',
    reviewNote:'Esta evidência é insuficiente e não poderia ser aprovada.'};
   assert.equal((await api(reviewPath,missing,owner)).status,422);
   assert.equal((await api(reviewPath,missing,outsider)).status,404);
   assert.equal((await api(reviewPath,missing,adminB)).status,404);
   assert.equal((await api(reviewPath,{...missing,decision:'rejeitada'},owner)).status,201);
   const first={projectId:pA,suggestionId:suggestions[0].id,
    expectedRevision:0,decision:'aprovada',
    reviewNote:'Trecho e página conferidos manualmente no documento anexado.'};
   assert.equal((await api(reviewPath,first)).status,401);
   assert.equal((await api(reviewPath,first,outsider)).status,404);
   assert.equal((await api(reviewPath,first,owner,'https://attacker.invalid')).status,403);
   assert.equal((await api(reviewPath,{...first,municipalityId:b},owner)).status,400);
   assert.equal((await api(reviewPath,{...first,suggestionId:suggestions[2].id},owner)).status,422);
   assert.equal((await api(reviewPath,{...first,reviewNote:'curto'},owner)).status,400);
   const ok=await api(reviewPath,first,owner);
   assert.equal(ok.status,201);assert.equal(ok.data.revision,1);
   assert.equal((await api(reviewPath,first,owner)).status,409);
   const revise={...first,expectedRevision:1,decision:'pendente',
    reviewNote:'É necessário conferir nova evidência antes da decisão final.'};
   const race=await Promise.all([api(reviewPath,revise,owner),api(reviewPath,{
    ...revise,decision:'rejeitada',
    reviewNote:'Equipe identificou que a obrigação é de outra modalidade.'
   },adminA)]);
   assert.deepEqual(race.map(x=>x.status).sort(),[201,409]);
   const events=(await admin.query(
    'SELECT revision,decision,review_note FROM project_edict_suggestion_reviews '+
    'WHERE suggestion_id=$1 ORDER BY revision',[suggestions[0].id])).rows;
   assert.deepEqual(events.map(e=>e.revision),[1,2]);
   assert.equal(events[0].decision,'aprovada');
   assert.equal(events[1].decision!=='aprovada',true);
   const history=await page('/projetos/'+pA+'/extracao-edital/'+suggestions[0].id,owner);
   assert.equal(history.status,200);
   assert.ok(history.html.includes('data-revision="1"'));
   assert.ok(history.html.includes('data-revision="2"'));
   assert.ok(history.html.includes('Trecho e página conferidos'));
   assert.equal((await page('/projetos/'+pB+'/extracao-edital/'+suggestions[0].id,adminB)).status,404);
   const noPublication=await admin.query(
    'SELECT COUNT(*)::integer AS n FROM opportunity_requirements WHERE municipality_id=$1',[a]);
   assert.equal(noPublication.rows[0].n,0,'Aprovação interna jamais publica regra de edital');
  });
  await t.test('RLS da role web e imutabilidade de lotes e eventos',async()=>{
   assert.equal((await app.query('SELECT * FROM project_edict_extraction_batches')).rowCount,0);
   assert.equal((await app.query('SELECT * FROM project_edict_suggestions')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[adminB.id]);
    for(const table of ['project_edict_extraction_batches','project_edict_suggestions',
     'project_edict_suggestion_reviews'])
     assert.equal((await app.query('SELECT * FROM '+table)).rowCount,0);
    for(const [sql,args] of [
     ['UPDATE project_edict_suggestions SET source_excerpt=$1 WHERE id=$2',
      ['Tentativa de adulterar evidência',suggestions[0].id]],
     ['DELETE FROM project_edict_suggestion_reviews WHERE suggestion_id=$1',
      [suggestions[0].id]]
    ]){
     await app.query('SAVEPOINT forbid');
     await assert.rejects(app.query(sql,args),/permission denied/i);
     await app.query('ROLLBACK TO SAVEPOINT forbid');
    }
   }finally{await app.query('ROLLBACK');}
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
    assert.equal((await app.query('SELECT * FROM project_edict_suggestions '+
     'WHERE batch_id=$1',[batchId])).rowCount,3);
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cityIds.length){
    for(const table of ['project_edict_suggestion_reviews',
     'project_edict_suggestions','project_edict_extraction_batches',
     'project_document_versions','project_document_events','project_document_items',
     'project_document_checklists','municipal_document_templates'])
     await admin.query('DELETE FROM '+table+' WHERE municipality_id=ANY($1::uuid[])',[cityIds]);
   }
   if(projectIds.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projectIds]);
   if(cityIds.length)await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cityIds]);
   if(userIds.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[userIds]);
   if(cityIds.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cityIds]);
  }finally{await app.end();await admin.end();}
 }
});
