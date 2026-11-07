import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF-036 exige PostgreSQL e HTTP descartáveis.');

test('AF-036: referências reais, etapas COFIEX, consulta humana e proteção municipal',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const password='COFIEX-CI-Only-2026!',hash=await bcrypt.hash(password,10);
 const cities=[],users=[],projects=[],opps=[];
 async function city(name){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['COFIEX sintético '+tag+' '+name]);cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function who(municipality,label,role){
  const email='cofiex-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query(
   'INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Operador '+label,email,hash,role]);
  users.push(r.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({email,password})});
  assert.equal(login.status,200);
  return {id:r.rows[0].id,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(municipality,owner,label,opp=null){
  const r=await admin.query(
   'INSERT INTO projects(municipality_id,owner_user_id,title,opportunity_id) '+
   'VALUES($1,$2,$3,$4) RETURNING id',
   [municipality,owner.id,'Pleito COFIEX '+label+' '+tag,opp]);
  projects.push(r.rows[0].id);return r.rows[0].id;
 }
 async function api(body,actor,origin=base){
  const response=await fetch(base+'/api/projects/cofiex/checks',{
   method:'POST',headers:{origin,'content-type':'application/json',
    ...(actor?.cookie?{cookie:actor.cookie}:{})},
   body:JSON.stringify(body)});
  const raw=await response.text();let data;
  try{data=JSON.parse(raw);}catch{data={error:raw.slice(0,200)};}
  return {status:response.status,data};
 }
 async function page(path,actor){
  const response=await fetch(base+path,{redirect:'manual',
   headers:actor?.cookie?{cookie:actor.cookie}:{}});
  return {status:response.status,html:await response.text()};
 }
 let tenantA,tenantB,owner,reviewer,nonOwner,foreign,projectA,projectB,otherA;
 const stage='acessar_pfe';
 const good={
  projectId:'',stageCode:stage,expectedRevision:0,
  consultationState:'em_preparacao',consultedOn:'2026-11-06',
  note:'Consulta interna de referência PFE com pendência de conferência documental.',
  acknowledgedLimits:true
 };
 try{
  tenantA=await city('A');tenantB=await city('B');
  owner=await who(tenantA,'owner','analyst');
  reviewer=await who(tenantA,'reviewer','admin');
  nonOwner=await who(tenantA,'other','analyst');
  foreign=await who(tenantB,'foreign','admin');
  projectA=await project(tenantA,owner,'A');
  projectB=await project(tenantB,foreign,'B');
  otherA=await project(tenantA,nonOwner,'Outro');
  good.projectId=projectA;

  await t.test('8 fontes oficiais e 12 etapas ordenadas com referências válidas',async()=>{
   const refs=(await admin.query('SELECT code,source_url,title,identified_on FROM '+
    'cofiex_official_references ORDER BY code')).rows;
   assert.equal(refs.length,8);
   assert.equal(new Set(refs.map(r=>r.source_url)).size,8);
   assert.ok(refs.every(x=>x.source_url.startsWith('https://')));
   assert.ok(refs.some(x=>x.source_url==='https://pfe.sistema.gov.br/'));
   assert.ok(refs.some(x=>x.code==='normas_cofiex'));
   const stages=(await admin.query(
    'SELECT s.code,s.stage_number,r.source_url FROM cofiex_consultation_stages s '+
    'JOIN cofiex_official_references r ON r.code=s.reference_code '+
    'ORDER BY s.stage_number')).rows;
   assert.equal(stages.length,12);
   assert.deepEqual(stages.map(x=>x.stage_number),
    Array.from({length:12},(_,i)=>i+1));
   const catalog=await page('/cofiex',owner);
   assert.equal(catalog.status,200);
   assert.equal((catalog.html.match(/data-cofiex-reference="/g)||[]).length,8);
   assert.ok(catalog.html.includes('Portal de Financiamento Externo'));
   assert.ok(catalog.html.includes('não são ofertas de crédito'));
   assert.equal((await page('/cofiex')).status,307);
   const list=await page('/projetos/'+projectA+'/cofiex',owner);
   assert.equal(list.status,200);
   assert.equal((list.html.match(/data-cofiex-stage="/g)||[]).length,12);
   assert.ok(list.html.includes('12 etapas'));
   assert.ok(list.html.includes('sem consulta')||list.html.includes('Sem consulta'));
   assert.equal((await page('/projetos/'+projectA+'/cofiex',foreign)).status,404);
   assert.equal((await page('/projetos/'+projectA+'/cofiex/'+stage,foreign)).status,404);
   assert.equal((await page('/projetos/'+projectA+'/cofiex/'+stage)).status,307);
   assert.equal((await page('/projetos/'+projectA+'/cofiex/fonte-inexistente',owner)).status,404);
  });

  await t.test('API recusa usuário não titular, tenant cruzado e dados malformados',async()=>{
   assert.equal((await api(good)).status,401);
   assert.equal((await api(good,nonOwner)).status,404);
   assert.equal((await api(good,foreign)).status,404);
   assert.equal((await api({...good,projectId:projectB},reviewer)).status,404);
   assert.equal((await api({...good,projectId:otherA},owner)).status,404);
   assert.equal((await api(good,owner,'https://evil.invalid')).status,403);
   assert.equal((await api({...good,municipalityId:tenantB},owner)).status,400);
   assert.equal((await api({...good,referenceCode:'portal_pfe'},owner)).status,400);
   assert.equal((await api({...good,stageCode:'nao_existe'},owner)).status,404);
   assert.equal((await api({...good,consultationState:'formalmente_aprovado'},owner)).status,400);
   assert.equal((await api({...good,consultedOn:'2027-01-01'},owner)).status,422);
   assert.equal((await api({...good,consultedOn:'2026-02-30'},owner)).status,422);
   assert.equal((await api({...good,note:'Curta'},owner)).status,400);
   assert.equal((await api({...good,acknowledgedLimits:false},owner)).status,400);
   assert.equal((await api({...good,expectedRevision:1000},owner)).status,400);
   const ok=await api(good,owner);
   assert.equal(ok.status,201);
   assert.equal(ok.data.revision,1);
   assert.equal(ok.data.scope,'consulta_interna_sem_protocolo_oficial');
   assert.equal((await api(good,owner)).status,409);
   const own=await page('/projetos/'+projectA+'/cofiex',owner);
   assert.equal(own.status,200);
   assert.ok(own.html.includes('Consulta interna')||
    own.html.includes('Em preparação interna'));
   const history=await page('/projetos/'+projectA+'/cofiex/'+stage,owner);
   assert.equal(history.status,200);
   assert.ok(history.html.includes('data-cofiex-revision="1"'));
   assert.ok(history.html.includes('não comprovam'));
  });

  await t.test('revisão concorrente e fonte congelada com SHA-256',async()=>{
   const next={...good,expectedRevision:1,
    consultationState:'conferido_internamente',
    note:'Equipe reviu os materiais institucionais sem protocolar ou certificar pleito.'};
   const competing=await Promise.all([
    api(next,owner),
    api({...next,note:'Consulta institucional conferida pelo administrador, sem prova de envio.'},reviewer)
   ]);
   assert.deepEqual(competing.map(x=>x.status).sort(),[201,409]);
   const third=await api({...next,expectedRevision:2,
    consultationState:'revisao_necessaria'},owner);
   assert.equal(third.status,201);assert.equal(third.data.revision,3);
   const versions=(await admin.query(
    'SELECT revision,consultation_state,source_url_snapshot,'+
    'reference_code,snapshot_sha256,recorded_by FROM project_cofiex_consultation_events '+
    'WHERE municipality_id=$1 AND project_id=$2 AND stage_code=$3 '+
    'ORDER BY revision',[tenantA,projectA,stage])).rows;
   assert.deepEqual(versions.map(v=>v.revision),[1,2,3]);
   assert.ok(versions.every(v=>v.reference_code==='portal_pfe'));
   assert.ok(versions.every(v=>v.source_url_snapshot==='https://pfe.sistema.gov.br/'));
   assert.ok(versions.every(v=>/^[a-f0-9]{64}$/.test(v.snapshot_sha256)));
   assert.notEqual(versions[0].snapshot_sha256,versions[1].snapshot_sha256);
   const history=await page('/projetos/'+projectA+'/cofiex/'+stage,reviewer);
   assert.equal(history.status,200);
   for(const n of [1,2,3])assert.ok(history.html.includes('data-cofiex-revision="'+n+'"'));
   assert.ok(history.html.includes('SHA-256'));
  });

  await t.test('projeto com oportunidade fictícia não aceita etapa de consulta',async()=>{
   const o=(await admin.query(
    'INSERT INTO opportunities(title,provider,source_url,is_example) '+
    'VALUES($1,$2,$3,true) RETURNING id',
    ['Oportunidade COFIEX fictícia '+tag,'Órgão de Teste','https://www.gov.br/']
   )).rows[0].id;
   opps.push(o);
   const synthetic=await project(tenantA,owner,'Fictício',o);
   assert.equal((await api({...good,projectId:synthetic},owner)).status,404);
   assert.ok((await page('/projetos/'+synthetic+'/cofiex',owner)).html.includes(
    'registro de conferência desabilitado'));
  });

  await t.test('RLS não expõe notas entre municípios e role web é append-only',async()=>{
   assert.equal((await app.query('SELECT * FROM project_cofiex_consultation_events')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[tenantB]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[foreign.id]);
    assert.equal((await app.query('SELECT * FROM project_cofiex_consultation_events')).rowCount,0);
    for(const sql of [
     'DELETE FROM project_cofiex_consultation_events WHERE municipality_id=$1',
     "UPDATE project_cofiex_consultation_events SET note='Adulterado' WHERE municipality_id=$1"
    ]){
     await app.query('SAVEPOINT denied');
     await assert.rejects(app.query(sql,[tenantA]),/permission denied/i);
     await app.query('ROLLBACK TO SAVEPOINT denied');
    }
   }finally{await app.query('ROLLBACK');}
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[tenantA]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[owner.id]);
    const rows=await app.query(
     'SELECT count(*)::integer AS n FROM project_cofiex_consultation_events '+
     'WHERE project_id=$1',[projectA]);
    assert.equal(rows.rows[0].n,3);
   }finally{await app.query('ROLLBACK');}
   const foreignProject=await page('/projetos/'+projectB+'/cofiex',foreign);
   assert.equal(foreignProject.status,200);
   assert.ok(foreignProject.html.includes('12 etapas'));
   assert.ok(!foreignProject.html.includes('Consulta institucional conferida pelo administrador'));
  });
 }finally{
  try{
   if(cities.length)await admin.query(
    'DELETE FROM project_cofiex_consultation_events WHERE municipality_id=ANY($1::uuid[])',
    [cities]);
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(opps.length)await admin.query('DELETE FROM opportunities WHERE id=ANY($1::uuid[])',[opps]);
   if(cities.length)await admin.query(
    'DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
