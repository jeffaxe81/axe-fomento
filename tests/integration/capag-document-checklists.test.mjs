import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {UPSERT_CAPAG_SQL} from '../../lib/capag-upsert-sql.mjs';
import {START_DOCUMENT_CHECKLIST_SQL,UPDATE_DOCUMENT_ITEM_SQL} from '../../lib/document-checklist-sql.mjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
  !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('Execução de testes exige PostgreSQL descartável.');

test('AF-012/017: CAPAG documentada e checklist por modalidade com isolamento municipal',async(t)=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,suffix=randomUUID().slice(0,8);
 const cities=[],users=[],projects=[];
 const password='Somente-Teste-Capag-Checklist-2026!';
 const hash=await bcrypt.hash(password,10);
 async function city(tag){
   const res=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
    ['Dados-'+suffix+'-'+tag]);cities.push(res.rows[0].id);return res.rows[0].id;
 }
 async function actor(tenant,tag,role){
   const email='documentos-'+suffix+'-'+tag+'@example.invalid';
   const res=await admin.query(
    'INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [tenant,'Equipe '+tag,email,hash,role]);
   const id=res.rows[0].id;users.push(id);
   const login=await fetch(base+'/api/auth/login',{method:'POST',
     headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
   assert.equal(login.status,200);
   return {id,tenant,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(tenant,owner,label){
   const res=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) VALUES($1,$2,$3) RETURNING id',
     [tenant,owner,label]);projects.push(res.rows[0].id);return res.rows[0].id;
 }
 async function request(method,path,payload,who,origin=base){
   const response=await fetch(base+path,{method,
     headers:{'content-type':'application/json',origin,...(who?.cookie?{cookie:who.cookie}:{})},
     body:JSON.stringify(payload)});
   return {status:response.status,json:await response.json()};
 }
 async function page(path,who){
   const response=await fetch(base+path,{redirect:'manual',
     headers:who?.cookie?{cookie:who.cookie}:{}});return {status:response.status,html:await response.text()};
 }
 try{
   const a=await city('A'),b=await city('B');
   const adminA=await actor(a,'admin-a','admin');
   const analystA=await actor(a,'analyst-a','analyst');
   const adminB=await actor(b,'admin-b','admin');
   const projectA=await project(a,analystA.id,'Projeto documental A '+suffix);
   const projectB=await project(b,adminB.id,'Projeto documental B '+suffix);
   const capagPayload={classification:'B+',baseYear:2025,
     referenceDate:'2026-09-01',
     officialUrl:'https://www.tesourotransparente.gov.br/temas/estados-e-municipios/capacidade-de-pagamento-capag',
     sourceLabel:'Capag Municípios 2026 - referência 01/09/2026'};
   await t.test('sem dado CAPAG a página mostra ausência, depois exibe classificação e origem',async()=>{
     const empty=await page('/municipio',adminA);
     assert.equal(empty.status,200);assert.ok(empty.html.includes('Sem CAPAG registrada'));
     const route='/api/municipality/capag';
     assert.equal((await request('POST',route,capagPayload)).status,401);
     assert.equal((await request('POST',route,capagPayload,analystA)).status,403);
     assert.equal((await request('POST',route,{...capagPayload,municipalityId:b},adminA)).status,400);
     assert.equal((await request('POST',route,capagPayload,adminA,'https://atacante.invalid')).status,403);
     assert.equal((await request('POST',route,{...capagPayload,officialUrl:'https://tesourotransparente.gov.br.atacante.invalid'},adminA)).status,400);
     assert.equal((await request('POST',route,{...capagPayload,referenceDate:'2035-01-01'},adminA)).status,400);
     assert.equal((await request('POST',route,{...capagPayload,baseYear:2027},adminA)).status,400);
     const saved=await request('POST',route,capagPayload,adminA);
     assert.equal(saved.status,200);assert.equal(saved.json.changed,true);assert.equal(saved.json.version,1);
     const own=await page('/municipio',analystA);
     assert.equal(own.status,200);
     assert.ok(own.html.includes('B+'));
     assert.ok(own.html.includes('2025'));
     assert.ok(own.html.includes('01/09/2026'));
     assert.ok(own.html.includes('Capag Municípios 2026'));
     const foreign=await page('/municipio',adminB);
     assert.equal(foreign.status,200);
     assert.ok(foreign.html.includes('Sem CAPAG registrada'));
     assert.ok(!foreign.html.includes('Capag Municípios 2026'));
     const same=await request('POST',route,capagPayload,adminA);
     assert.equal(same.status,200);assert.equal(same.json.changed,false);assert.equal(same.json.version,1);
     const changed=await request('POST',route,{...capagPayload,classification:'A'},adminA);
     assert.equal(changed.status,200);assert.equal(changed.json.version,2);
     assert.equal((await admin.query('SELECT count(*)::int AS n FROM municipal_capag_history WHERE municipality_id=$1',[a])).rows[0].n,2);
     const actual=await admin.query('SELECT classification FROM municipal_capag WHERE municipality_id=$1',[a]);
     assert.equal(actual.rows[0].classification,'A');
   });

   let ownTemplate,foreignTemplate;
   await t.test('modelos são criados somente por admin e não vazam entre municípios',async()=>{
     const route='/api/document-templates';
     const model={modality:'financiamento',title:'Comprovante municipal revisado '+suffix,
       guidance:'Documento identificado na fonte oficial, conferir edição'};
     assert.equal((await request('POST',route,model)).status,401);
     assert.equal((await request('POST',route,model,analystA)).status,403);
     assert.equal((await request('POST',route,{...model,municipalityId:b},adminA)).status,400);
     assert.equal((await request('POST',route,model,adminA,'https://intruso.invalid')).status,403);
     assert.equal((await request('POST',route,{...model,modality:'invalida'},adminA)).status,400);
     const created=await request('POST',route,model,adminA);
     assert.equal(created.status,201);ownTemplate=created.json.id;
     assert.equal((await request('POST',route,model,adminA)).status,409);
     const foreign=await request('POST',route,{...model,title:'Documento exclusivo da prefeitura B'},adminB);
     assert.equal(foreign.status,201);foreignTemplate=foreign.json.id;
     const second=await request('POST',route,{...model,title:'Segundo documento para checklist '+suffix},adminA);
     assert.equal(second.status,201);
   });

   let item;
   await t.test('cópia de modelos por modalidade só ocorre uma vez por projeto',async()=>{
     const route='/api/projects/document-checklist';
     const payload={projectId:projectA,modality:'financiamento'};
     assert.equal((await request('POST',route,payload)).status,401);
     assert.equal((await request('POST',route,payload,analystA)).status,403);
     assert.equal((await request('POST',route,payload,adminB)).status,404);
     assert.equal((await request('POST',route,{...payload,municipalityId:b},adminA)).status,400);
     assert.equal((await request('POST',route,{...payload,modality:'convenio'},adminA)).status,409);
     const created=await request('POST',route,payload,adminA);
     assert.equal(created.status,201);assert.equal(created.json.created,true);
     assert.equal(created.json.itemsAdded,2);
     const again=await request('POST',route,payload,adminA);
     assert.equal(again.status,200);assert.equal(again.json.created,false);
     assert.equal(again.json.itemsAdded,0);
     assert.equal((await request('POST',route,{...payload,modality:'convenio'},adminA)).status,409);
     const view=await page('/projetos/'+projectA+'/documentos',analystA);
     assert.equal(view.status,200);assert.ok(view.html.includes('Financiamento'));
     assert.ok(view.html.includes('Comprovante municipal revisado '+suffix));
     assert.ok(!view.html.includes('Documento exclusivo da prefeitura B'));
     assert.equal((await page('/projetos/'+projectA+'/documentos',adminB)).status,404);
     assert.equal((await page('/projetos/'+projectA+'/documentos')).status,307);
     const res=await admin.query('SELECT id FROM project_document_items WHERE project_id=$1 AND template_id=$2',
       [projectA,ownTemplate]);assert.equal(res.rowCount,1);
     item=res.rows[0].id;
     const added=await request('POST','/api/document-templates',
       {modality:'financiamento',title:'Modelo posterior '+suffix,guidance:''},adminA);
     assert.equal(added.status,201);
     const retry=await request('POST',route,payload,adminA);
     assert.equal(retry.status,200);assert.equal(retry.json.itemsAdded,0);
     assert.equal((await admin.query('SELECT count(*)::int AS n FROM project_document_items WHERE project_id=$1',[projectA])).rows[0].n,2);
   });

   await t.test('mudança de status exige evidência e gera evento idempotente',async()=>{
     const route='/api/projects/document-item';
     const payload={projectId:projectA,itemId:item,status:'apresentado',
       evidenceNote:'Protocolo informado pela equipe na unidade municipal.'};
     assert.equal((await request('PATCH',route,payload)).status,401);
     assert.equal((await request('PATCH',route,{...payload,evidenceNote:'curto'},analystA)).status,400);
     assert.equal((await request('PATCH',route,{...payload,municipalityId:b},analystA)).status,400);
     assert.equal((await request('PATCH',route,payload,analystA,'https://intruso.invalid')).status,403);
     assert.equal((await request('PATCH',route,{...payload,projectId:projectB},analystA)).status,404);
     assert.equal((await request('PATCH',route,{...payload,itemId:foreignTemplate},analystA)).status,404);
     const saved=await request('PATCH',route,payload,analystA);
     assert.equal(saved.status,200);assert.equal(saved.json.changed,true);
     const repeat=await request('PATCH',route,payload,analystA);
     assert.equal(repeat.status,200);assert.equal(repeat.json.changed,false);
     assert.equal((await admin.query('SELECT count(*)::int AS n FROM project_document_events WHERE item_id=$1',[item])).rows[0].n,1);
     assert.ok((await page('/projetos/'+projectA+'/documentos',adminA)).html.includes(payload.evidenceNote));
     assert.equal((await request('PATCH',route,{...payload,status:'dispensado',
       evidenceNote:'Dispensa declarada e justificada para teste.'},analystA)).status,200);
     assert.equal((await request('PATCH',route,{...payload,status:'pendente',
       evidenceNote:''},analystA)).status,200);
     assert.equal((await admin.query('SELECT count(*)::int AS n FROM project_document_events WHERE item_id=$1',[item])).rows[0].n,3);
   });

   await t.test('RLS impede leitura sem contexto e escrita cruzada no PostgreSQL',async()=>{
     assert.equal((await app.query('SELECT * FROM municipal_capag')).rowCount,0);
     assert.equal((await app.query('SELECT * FROM municipal_document_templates')).rowCount,0);
     assert.equal((await app.query('SELECT * FROM project_document_items')).rowCount,0);
     await app.query('BEGIN');
     try{
       await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
       await app.query("SELECT set_config('app.actor_id',$1,true)",[analystA.id]);
       assert.equal((await app.query('SELECT * FROM municipal_capag')).rowCount,1);
       assert.equal((await app.query('SELECT * FROM municipal_document_templates')).rowCount,3);
       assert.equal((await app.query('SELECT * FROM project_document_items')).rowCount,2);
       const capagResult=await app.query(UPSERT_CAPAG_SQL,
         [a,'A',2025,'2026-09-01',capagPayload.officialUrl,capagPayload.sourceLabel,analystA.id]);
       assert.equal(capagResult.rows[0].changed,false);
       const cross=await app.query(UPDATE_DOCUMENT_ITEM_SQL,
         [a,projectB,item,'pendente','',analystA.id]);
       assert.equal(cross.rows[0].applicable,false);
       const initialize=await app.query(START_DOCUMENT_CHECKLIST_SQL,
         [a,projectB,'financiamento',analystA.id]);
       assert.equal(initialize.rows[0].project_exists,false);
       await app.query('SAVEPOINT cross_tenant');
       await assert.rejects(app.query('INSERT INTO municipal_document_templates(municipality_id,modality,title,created_by) '+
         'VALUES($1,$2,$3,$4)',[b,'convenio','Documento de invasão de prefeitura',adminB.id]),/row-level security/i);
       await app.query('ROLLBACK TO SAVEPOINT cross_tenant');
     }finally{await app.query('ROLLBACK');}
   });
 }finally{
   try{
     if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
     if(cities.length){
       await admin.query('DELETE FROM municipal_document_templates WHERE municipality_id=ANY($1::uuid[])',[cities]);
       await admin.query('DELETE FROM municipal_capag_history WHERE municipality_id=ANY($1::uuid[])',[cities]);
       await admin.query('DELETE FROM municipal_capag WHERE municipality_id=ANY($1::uuid[])',[cities]);
     }
     if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
     if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
   }finally{await app.end();await admin.end();}
 }
});
