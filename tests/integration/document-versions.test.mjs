import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('Anexos requerem banco de testes isolado');

test('AF-018: anexos privados criptografados, versão imutável e controle de acesso',async(t)=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const suffix=randomUUID().slice(0,8),base=process.env.TEST_BASE_URL;
 const cities=[],users=[],projects=[],templates=[];
 const pass='Somente-Teste-Anexos-2026!';
 const hash=await bcrypt.hash(pass,10);
 async function actor(city,label,role){
  const email='anexo-'+suffix+'-'+label+'@example.invalid';
  const x=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id',
   [city,'Equipe '+label,email,hash,role]);
  users.push(x.rows[0].id);
  const response=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password:pass})});
  assert.equal(response.status,200);
  return {id:x.rows[0].id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function call(method,path,body,user,origin=base){
  const headers={'origin':origin,...(user?.cookie?{cookie:user.cookie}:{})};
  const response=await fetch(base+path,{method,headers,body});
  const json=await response.json();
  return {status:response.status,json};
 }
 async function upload(projectId,itemId,content,user,filename='prova.pdf',type='application/pdf',note='Versão preliminar entregue para validação'){
  const data=new FormData();
  data.set('projectId',projectId);data.set('itemId',itemId);data.set('note',note);
  data.set('file',new Blob([content],{type}),filename);
  return await call('POST','/api/projects/document-attachments',data,user);
 }
 const doc1=Buffer.from('%PDF-1.4\n%Arquivo municipal de teste\n1 0 obj\n<<>>\nendobj\n%%EOF');
 const doc2=Buffer.from('%PDF-1.4\n%Versão revisada\n1 0 obj\n<<>>\nendobj\n%%EOF');
 try{
  for(const label of ['A','B']){
   const x=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",['Anexos-'+suffix+'-'+label]);
   cities.push(x.rows[0].id);
  }
  const own=await actor(cities[0],'admin-a','admin');
  const analyst=await actor(cities[0],'analyst-a','analyst');
  const other=await actor(cities[1],'admin-b','admin');
  for(const [city,user,title] of [[cities[0],analyst.id,'Projeto A'],[cities[1],other.id,'Projeto B']]){
   const result=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) VALUES($1,$2,$3) RETURNING id',
    [city,user,title+' '+suffix]);
   projects.push(result.rows[0].id);
  }
  for(const [city,user,title] of [[cities[0],own.id,'Ata de acompanhamento'],[cities[1],other.id,'Documento privado B']]){
   const result=await admin.query('INSERT INTO municipal_document_templates(municipality_id,modality,title,created_by) '+
    "VALUES($1,'convenio',$2,$3) RETURNING id",[city,title+' '+suffix,user]);
   templates.push(result.rows[0].id);
  }
  for(const [i,user] of [own,other].entries()){
   const init=await call('POST','/api/projects/document-checklist',
    JSON.stringify({projectId:projects[i],modality:'convenio'}),user);
   // JSON helper needs explicit content-type: call raw with explicit header below instead.
   assert.equal(init.status,400);
   const response=await fetch(base+'/api/projects/document-checklist',{method:'POST',
    headers:{origin:base,'content-type':'application/json',cookie:user.cookie},
    body:JSON.stringify({projectId:projects[i],modality:'convenio'})});
   assert.equal(response.status,201);
  }
  const [itemA]=(await admin.query('SELECT id FROM project_document_items WHERE project_id=$1',[projects[0]])).rows;
  const [itemB]=(await admin.query('SELECT id FROM project_document_items WHERE project_id=$1',[projects[1]])).rows;
  const download=(p,item,version)=>'/api/projects/'+p+'/documents/'+item+'/versions/'+version;

  await t.test('tentativas sem sessão, origem externa, formato incorreto e arquivos grandes',async()=>{
   assert.equal((await upload(projects[0],itemA.id,doc1)).status,401);
   const malicious=new FormData();
   malicious.set('projectId',projects[0]);malicious.set('itemId',itemA.id);
   malicious.set('note','Documento de teste com origem hostil');
   malicious.set('file',new Blob([doc1],{type:'application/pdf'}),'origem.pdf');
   assert.equal((await call('POST','/api/projects/document-attachments',malicious,analyst,
      'https://intruso.invalid')).status,403);
   assert.equal((await upload(projects[1],itemB.id,doc1,analyst)).status,409);
   assert.equal((await upload(projects[0],itemA.id,doc1,other)).status,409);
   assert.equal((await upload(projects[0],itemA.id,Buffer.from('not a PDF'),analyst)).status,415);
   assert.equal((await upload(projects[0],itemA.id,doc1,analyst,'ata.pdf','image/png')).status,415);
   assert.equal((await upload(projects[0],itemA.id,Buffer.alloc(2097153,65),analyst)).status,413);
   const before=await fetch(base+download(projects[0],itemA.id,1),{headers:{cookie:analyst.cookie}});
   assert.equal(before.status,404);
  });
  await t.test('upload válido é cifrado e pode ser recuperado apenas pelo município',async()=>{
   const first=await upload(projects[0],itemA.id,doc1,analyst);
   assert.equal(first.status,201);assert.equal(first.json.version,1);
   const rows=(await admin.query('SELECT ciphertext,sha256,nonce,auth_tag,content_length FROM '+
    'project_document_versions WHERE item_id=$1 AND version=1',[itemA.id])).rows;
   assert.equal(rows.length,1);
   assert.equal(rows[0].sha256,createHash('sha256').update(doc1).digest('hex'));
   assert.equal(rows[0].content_length,doc1.length);
   assert.ok(!rows[0].ciphertext.equals(doc1));
   assert.equal(rows[0].nonce.length,12);assert.equal(rows[0].auth_tag.length,16);
   const ownResponse=await fetch(base+download(projects[0],itemA.id,1),{
    headers:{cookie:own.cookie}});
   assert.equal(ownResponse.status,200);
   assert.deepEqual(Buffer.from(await ownResponse.arrayBuffer()),doc1);
   assert.match(ownResponse.headers.get('content-disposition'),/attachment/);
   assert.equal(ownResponse.headers.get('cache-control'),'no-store, private');
   assert.equal((await fetch(base+download(projects[0],itemA.id,1),{
    headers:{cookie:other.cookie}})).status,404);
   assert.equal((await fetch(base+download(projects[0],itemA.id,1))).status,401);
   const page=await fetch(base+'/projetos/'+projects[0]+'/documentos',{headers:{cookie:analyst.cookie}});
   assert.equal(page.status,200);
   const html=await page.text();
   assert.ok(html.includes('Baixar versão 1'));
   assert.ok(!html.includes('Documento privado B'));
   assert.equal((await fetch(base+'/projetos/'+projects[0]+'/documentos',{
    headers:{cookie:other.cookie},redirect:'manual'})).status,404);
  });
  await t.test('dois envios paralelos geram versões diferentes sem sobrescrever a anterior',async()=>{
   const replies=await Promise.all([
    upload(projects[0],itemA.id,doc2,analyst,'atualizado.pdf'),
    upload(projects[0],itemA.id,doc2,own,'revisado.pdf','application/pdf',
      'Nova conferência de documento da secretaria'),
   ]);
   assert.deepEqual(replies.map(x=>x.status),[201,201]);
   assert.deepEqual(replies.map(x=>x.json.version).sort((x,y)=>x-y),[2,3]);
   const previous=await fetch(base+download(projects[0],itemA.id,1),{
    headers:{cookie:analyst.cookie}});
   assert.deepEqual(Buffer.from(await previous.arrayBuffer()),doc1);
   const versions=await admin.query('SELECT version FROM project_document_versions WHERE item_id=$1 ORDER BY version',[itemA.id]);
   assert.deepEqual(versions.rows.map(x=>x.version),[1,2,3]);
   const original=await admin.query('SELECT current_version FROM project_document_items WHERE id=$1',[itemA.id]);
   assert.equal(original.rows[0].current_version,3);
  });
  await t.test('corrupção de autenticação criptográfica falha fechada',async()=>{
   const rows=await admin.query('SELECT auth_tag FROM project_document_versions WHERE item_id=$1 AND version=3',[itemA.id]);
   const original=rows.rows[0].auth_tag;
   try{
    await admin.query('UPDATE project_document_versions SET auth_tag=$3 WHERE item_id=$1 AND version=$2',
     [itemA.id,3,Buffer.alloc(16)]);
    const r=await fetch(base+download(projects[0],itemA.id,3),{headers:{cookie:analyst.cookie}});
    assert.equal(r.status,503);
   }finally{
    await admin.query('UPDATE project_document_versions SET auth_tag=$3 WHERE item_id=$1 AND version=$2',
     [itemA.id,3,original]);
   }
  });
  await t.test('RLS de PostgreSQL impede vazamento sem contexto e entre prefeituras',async()=>{
   assert.equal((await app.query('SELECT * FROM project_document_versions')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[cities[1]]);
    const rows=await app.query('SELECT * FROM project_document_versions');
    assert.equal(rows.rowCount,0);
    await app.query('SAVEPOINT denied');
    await assert.rejects(app.query('UPDATE project_document_versions SET file_name=$1 WHERE item_id=$2',
      ['intruso.pdf',itemA.id]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT denied');
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(templates.length)await admin.query('DELETE FROM municipal_document_templates WHERE id=ANY($1::uuid[])',[templates]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
