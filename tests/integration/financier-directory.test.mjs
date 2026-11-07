import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF-034 exige PostgreSQL e servidor HTTP descartáveis.');

test('AF-034: financiadores nacionais com curadoria municipal, fontes, filtros e versão',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8).toUpperCase();
 const cities=[],people=[];
 const pass='Financiers-CI-Only-2026!',hash=await bcrypt.hash(pass,10);
 async function city(suffix){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Diretório sintético '+tag+' '+suffix]);
  cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function actor(municipality,label,role){
  const email='financiers-'+tag.toLowerCase()+'-'+label+'@example.invalid';
  const r=await admin.query(
   'INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Analista '+label,email,hash,role]);
  people.push(r.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password:pass})});
  assert.equal(login.status,200);
  return {id:r.rows[0].id,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function post(path,body,who,origin=base){
  const response=await fetch(base+path,{method:'POST',
   headers:{origin,'content-type':'application/json',
    ...(who?.cookie?{cookie:who.cookie}:{})},
   body:JSON.stringify(body)});
  const raw=await response.text();let data;
  try{data=JSON.parse(raw);}catch{data={error:raw.slice(0,100)};}
  return {status:response.status,data};
 }
 async function get(path,who){
  const response=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});
  return {status:response.status,html:await response.text()};
 }
 const reference={
  referenceUrl:'https://www.gov.br/pt-br/servicos/financiamento-institucional',
  referenceTitle:'Página institucional de fontes de fomento',
  referenceSection:'Informações institucionais',
  checkStatus:'referencia_informada',checkedOn:null,
  evidenceNote:'Registro municipal de exemplo que não comprova financiamento disponível.'
 };
 function payload(code,overrides={}){
  return {referenceCode:code,name:'Instituição sintética nacional '+code,
   institutionType:'agencia_publica',financingModalities:['credito','subvencao'],
   thematicAreas:['saude','saneamento'],...reference,...overrides};
 }
 const create='/api/financiers',versions='/api/financiers/versions';
 let primaryId,cityA,cityB,adminA,adminB,analystA;
 try{
  cityA=await city('A');cityB=await city('B');
  adminA=await actor(cityA,'admin-a','admin');
  analystA=await actor(cityA,'analyst-a','analyst');
  adminB=await actor(cityB,'admin-b','admin');
  const initial=payload('FIN-'+tag+'-001');
  await t.test('registro segura fonte manual e distingue referência de financiamento disponível',async()=>{
   assert.equal((await post(create,initial)).status,401);
   assert.equal((await post(create,initial,analystA)).status,403);
   assert.equal((await post(create,initial,adminA,'https://attacker.invalid')).status,403);
   assert.equal((await post(create,{...initial,municipalityId:cityB},adminA)).status,400);
   assert.equal((await post(create,{...initial,institutionType:'hacker'},adminA)).status,400);
   assert.equal((await post(create,{...initial,financingModalities:['credito','credito']},adminA)).status,400);
   assert.equal((await post(create,{...initial,thematicAreas:['inexistente']},adminA)).status,400);
   assert.equal((await post(create,{...initial,referenceUrl:'http://www.gov.br'},adminA)).status,400);
   assert.equal((await post(create,{...initial,referenceUrl:'https://localhost:3000/teste'},adminA)).status,400);
   assert.equal((await post(create,{...initial,referenceUrl:'https://www.gov.br/?key=123'},adminA)).status,400);
   assert.equal((await post(create,{...initial,checkStatus:'consultada_internamente'},adminA)).status,400);
   assert.equal((await post(create,{...initial,checkedOn:'2029-01-01'},adminA)).status,400);
   const ok=await post(create,initial,adminA);
   assert.equal(ok.status,201);primaryId=ok.data.id;assert.ok(primaryId);
   assert.equal(ok.data.version,1);
   assert.equal(ok.data.scope,'municipal_reference_only');
   assert.equal((await post(create,initial,adminA)).status,409);
   const db=(await admin.query(
    'SELECT f.reference_code,f.institution_type,f.financing_modalities,'+
    'v.check_status,v.checked_on,v.snapshot_sha256 FROM municipal_financiers f '+
    'JOIN municipal_financier_versions v ON v.financier_id=f.id '+
    'WHERE f.id=$1',[primaryId])).rows[0];
   assert.equal(db.reference_code,initial.referenceCode);
   assert.equal(db.check_status,'referencia_informada');
   assert.equal(db.checked_on,null);
   assert.ok(/^[0-9a-f]{64}$/.test(db.snapshot_sha256));
   const other=await post(create,initial,adminB);
   assert.equal(other.status,201);
   assert.notEqual(other.data.id,primaryId);
   assert.equal((await get('/financiadores',analystA)).html.includes(initial.name),true);
   assert.equal((await get('/financiadores/'+primaryId,adminB)).status,404);
   assert.equal((await get('/financiadores')).status,307);
  });

  await t.test('filtros literais, modalidade/tema, paginação estável e origem por município',async()=>{
   const prefix='CONT'+tag;
   const inserted=await admin.query(
    'INSERT INTO municipal_financiers(municipality_id,reference_code,name,institution_type,'+
    'financing_modalities,thematic_areas,created_by) '+
    "SELECT $1,'FIN-'||$2||'-'||lpad(n::text,3,'0'),$3||' '||lpad(n::text,3,'0'),"+
    "'agencia_publica',ARRAY['credito'],ARRAY['saude'],$4 "+
    'FROM generate_series(1,28) n RETURNING id',[cityA,prefix,'Diretório paginação '+tag,adminA.id]);
   for(const [i,row] of inserted.rows.entries()){
    await admin.query(
     'INSERT INTO municipal_financier_versions('+
     'municipality_id,financier_id,version,reference_url,reference_title,'+
     'reference_section,check_status,evidence_note,snapshot_sha256,recorded_by) '+
     "VALUES($1,$2,1,'https://www.gov.br/institucional',"+
     "'Página institucional de teste','Seção institucional',"+
     "'referencia_informada',$3,repeat('a',64),$4)",
     [cityA,row.id,'Registro de demonstração não confirmado '+i+'.',adminA.id]);
   }
   const terms=new URLSearchParams({busca:'Diretório paginação '+tag,
    area:'saude',modalidade:'credito'});
   const p1=await get('/financiadores?'+terms,analystA);
   assert.equal(p1.status,200);
   assert.ok(p1.html.includes('Página 1'));
   assert.ok(p1.html.includes('pagina=2'));
   assert.equal((p1.html.match(/data-financier-id="/g)||[]).length,25);
   const p2=await get('/financiadores?'+terms+'&pagina=2',analystA);
   assert.equal(p2.status,200);
   assert.equal((p2.html.match(/data-financier-id="/g)||[]).length,3);
   assert.ok(!p2.html.includes('pagina=3'));
   const noArea=await get('/financiadores?busca='+encodeURIComponent(
    'Diretório paginação '+tag)+'&area=educacao',analystA);
   assert.equal(noArea.status,200);
   assert.ok(noArea.html.includes('Nenhuma instituição registrada'));
   const literal=await get('/financiadores?busca=100%25_',analystA);
   assert.equal(literal.status,200);
   assert.ok(literal.html.includes('Nenhuma instituição registrada'));
   const noOtherTenant=await get('/financiadores?busca='+tag,adminB);
   assert.equal(noOtherTenant.status,200);
   assert.ok(!noOtherTenant.html.includes('Diretório paginação '+tag));
   assert.ok(!noOtherTenant.html.includes('FIN-CONT'+tag));
  });

  await t.test('nova versão declarada, data humana e controle otimista de concorrência',async()=>{
   const checked={financierId:primaryId,expectedVersion:1,
    ...reference,checkStatus:'consultada_internamente',checkedOn:'2026-01-15',
    referenceSection:'Dados básicos do portal institucional',
    evidenceNote:'A equipe municipal declarou ter consultado esta página em janeiro.'};
   assert.equal((await post(versions,checked)).status,401);
   assert.equal((await post(versions,checked,analystA)).status,403);
   assert.equal((await post(versions,checked,adminB)).status,404);
   assert.equal((await post(versions,{...checked,financierId:randomUUID()},adminA)).status,404);
   assert.equal((await post(versions,{...checked,expectedVersion:2},adminA)).status,409);
   assert.equal((await post(versions,{...checked,municipalityId:cityB},adminA)).status,400);
   assert.equal((await post(versions,{...checked,checkedOn:'2030-01-01'},adminA)).status,400);
   const race=await Promise.all([
    post(versions,checked,adminA),
    post(versions,{...checked,evidenceNote:
     'Outra observação municipal enviada simultaneamente pelo mesmo setor.'},adminA)
   ]);
   assert.deepEqual(race.map(x=>x.status).sort(),[201,409]);
   const changed=await post(versions,{...checked,expectedVersion:2,
    checkStatus:'revisao_necessaria',checkedOn:null,
    referenceTitle:'Registro institucional aguardando revisão',
    evidenceNote:'A fonte necessita conferência e não pode comprovar oferta disponível.'},adminA);
   assert.equal(changed.status,201);assert.equal(changed.data.version,3);
   const list=(await admin.query(
    'SELECT version,check_status,checked_on,reference_title,snapshot_sha256 '+
    'FROM municipal_financier_versions WHERE financier_id=$1 ORDER BY version',
    [primaryId])).rows;
   assert.deepEqual(list.map(x=>x.version),[1,2,3]);
   assert.equal(list[0].check_status,'referencia_informada');
   assert.equal(list[1].check_status,'consultada_internamente');
   assert.equal(list[1].checked_on.toISOString().slice(0,10),'2026-01-15');
   assert.equal(list[2].check_status,'revisao_necessaria');
   assert.ok(list.every(x=>/^[0-9a-f]{64}$/.test(x.snapshot_sha256)));
   assert.notEqual(list[0].snapshot_sha256,list[1].snapshot_sha256);
   const detail=await get('/financiadores/'+primaryId,analystA);
   assert.equal(detail.status,200);
   for(const version of [1,2,3])assert.ok(detail.html.includes(
    'data-version="'+version+'"'));
   assert.ok(detail.html.includes('Revisão necessária'));
   assert.ok(detail.html.includes('15/01/2026'));
   assert.ok(detail.html.includes('não comprova oferta disponível'));
  });
  await t.test('FORCE RLS e histórico append-only sob credencial restrita',async()=>{
   assert.equal((await app.query('SELECT * FROM municipal_financiers')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[cityB]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[adminB.id]);
    assert.equal((await app.query(
     'SELECT * FROM municipal_financiers WHERE id=$1',[primaryId])).rowCount,0);
    assert.equal((await app.query(
     'SELECT * FROM municipal_financier_versions WHERE financier_id=$1',[primaryId])).rowCount,0);
    for(const sql of [
     'DELETE FROM municipal_financier_versions WHERE financier_id=$1',
     "UPDATE municipal_financier_versions SET evidence_note='Adulteração' WHERE financier_id=$1",
     'DELETE FROM municipal_financiers WHERE id=$1'
    ]){
     await app.query('SAVEPOINT forbidden');
     await assert.rejects(app.query(sql,[primaryId]),/permission denied/i);
     await app.query('ROLLBACK TO SAVEPOINT forbidden');
    }
   }finally{await app.query('ROLLBACK');}
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[cityA]);
    const r=await app.query(
     'SELECT count(*)::integer AS n FROM municipal_financier_versions WHERE financier_id=$1',
     [primaryId]);assert.equal(r.rows[0].n,3);
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cities.length){
    await admin.query('DELETE FROM municipal_financier_versions WHERE municipality_id=ANY($1::uuid[])',
     [cities]);
    await admin.query('DELETE FROM municipal_financiers WHERE municipality_id=ANY($1::uuid[])',
     [cities]);
    await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',
     [cities]);
   }
   if(people.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[people]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',
    [cities]);
  }finally{await app.end();await admin.end();}
 }
});
