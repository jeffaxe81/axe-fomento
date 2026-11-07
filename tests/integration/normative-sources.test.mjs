import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('AF-028 requer PostgreSQL e serviço HTTP descartáveis do CI.');

test('AF-028: origem, jurisdição, versões históricas, tenant e controle de concorrência',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],people=[];
 const password='Normative-Tests-Only-2026!',hash=await bcrypt.hash(password,10);
 async function city(label,uf){
  const r=await admin.query('INSERT INTO municipalities(name,uf) VALUES($1,$2) RETURNING id',
   ['Norma sintética '+tag+' '+label,uf]);cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function person(municipality,label,role){
  const email='normativa-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Norma '+label,email,hash,role]);
  people.push(r.rows[0].id);
  const response=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(response.status,200);
  return {id:r.rows[0].id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function api(path,payload,who,origin=base){
  const response=await fetch(base+path,{method:'POST',headers:{
   origin,'content-type':'application/json',...(who?.cookie?{cookie:who.cookie}:{})
  },body:JSON.stringify(payload)});
  const raw=await response.text();let data;
  try{data=JSON.parse(raw);}catch{data={error:raw.slice(0,200)};}
  return {status:response.status,data};
 }
 async function page(path,who){
  const res=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});return {status:res.status,html:await res.text()};
 }
 try{
  const a=await city('A','SC'),b=await city('B','RS');
  const adminA=await person(a,'admin-a','admin');
  const analystA=await person(a,'analyst-a','analyst');
  const adminB=await person(b,'admin-b','admin');
  const schema='/api/normativos',versionsPath=schema+'/versions';
  const initial={
   referenceCode:'LEI '+tag.toUpperCase()+'/2026',
   title:'Norma ilustrativa de testes '+tag,
   jurisdiction:'municipal',stateUf:'',
   sourceUrl:'https://www.gov.br/legislacao/sintetica',
   publishedOn:'2025-01-15',validFrom:'2026-01-01',validUntil:null,
   sourceSection:'Artigo 3º',
   excerpt:'Trecho declarado para fins de teste sem valor jurídico ou oficial.',
   contextNote:'Registro manual inicial autorizado apenas no município do teste.'
  };
  let sourceId;
  await t.test('cadastro administrativo, jurisdição e entrada malformada',async()=>{
   assert.equal((await api(schema,initial)).status,401);
   assert.equal((await api(schema,initial,analystA)).status,403);
   assert.equal((await api(schema,initial,adminA,'https://attacker.invalid')).status,403);
   assert.equal((await api(schema,{...initial,municipalityId:b},adminA)).status,400);
   assert.equal((await api(schema,{...initial,stateUf:'RS'},adminA)).status,400);
   assert.equal((await api(schema,{...initial,sourceUrl:'http://example.org'},adminA)).status,400);
   assert.equal((await api(schema,{...initial,sourceUrl:'https://127.0.0.1/manual'},adminA)).status,400);
   assert.equal((await api(schema,{...initial,publishedOn:'2027-01-01'},adminA)).status,400);
   assert.equal((await api(schema,{...initial,validUntil:'2025-12-31'},adminA)).status,400);
   assert.equal((await api(schema,{...initial,jurisdiction:'estadual',stateUf:''},adminA)).status,400);
   assert.equal((await api(schema,{...initial,jurisdiction:'federal',stateUf:'SC'},adminA)).status,400);
   const ok=await api(schema,initial,adminA);
   assert.equal(ok.status,201);assert.equal(ok.data.version,1);
   sourceId=ok.data.id;assert.ok(sourceId);
   assert.equal((await api(schema,initial,adminA)).status,409);
   const own=(await admin.query('SELECT jurisdiction,state_uf FROM municipal_normative_sources '+
    'WHERE id=$1',[sourceId])).rows[0];
   assert.equal(own.jurisdiction,'municipal');assert.equal(own.state_uf,'SC');
   const list=await page('/normativos',analystA);
   assert.equal(list.status,200);assert.ok(list.html.includes(initial.referenceCode));
   assert.equal((await page('/normativos',adminB)).html.includes(initial.referenceCode),false);
   const foreign=await page('/normativos/'+sourceId,adminB);
   assert.equal(foreign.status,404);
   assert.equal((await page('/normativos')).status,307);
  });
  await t.test('histórico imutável e versões concorrentes',async()=>{
   const update={sourceId,expectedVersion:1,
    sourceUrl:'https://www.gov.br/legislacao/sintetica-v2',
    publishedOn:'2026-01-20',validFrom:'2026-02-01',validUntil:'2027-12-31',
    sourceSection:'Artigo 4º',
    excerpt:'Novo trecho informado na revisão da equipe em ambiente descartável.',
    contextNote:'Segunda versão declarada sem sobrescrever a referência histórica.'};
   assert.equal((await api(versionsPath,update)).status,401);
   assert.equal((await api(versionsPath,update,analystA)).status,403);
   assert.equal((await api(versionsPath,update,adminB)).status,404);
   assert.equal((await api(versionsPath,{...update,expectedVersion:2},adminA)).status,409);
   assert.equal((await api(versionsPath,{...update,sourceId:randomUUID()},adminA)).status,404);
   assert.equal((await api(versionsPath,{...update,validUntil:'2025-01-01'},adminA)).status,400);
   const ok=await api(versionsPath,update,adminA);
   assert.equal(ok.status,201);assert.equal(ok.data.version,2);
   assert.equal((await api(versionsPath,update,adminA)).status,409);
   const last=await api(versionsPath,{...update,expectedVersion:2,
    excerpt:'Terceira referência histórica declarada, sem reescrever a versão anterior.',
    validUntil:null},adminA);
   assert.equal(last.status,201);assert.equal(last.data.version,3);
   const persisted=(await admin.query(
    'SELECT version,source_url,valid_from,valid_until,snapshot_sha256 '+
    'FROM municipal_normative_versions WHERE source_id=$1 ORDER BY version',
    [sourceId])).rows;
   assert.deepEqual(persisted.map(x=>x.version),[1,2,3]);
   assert.equal(persisted[0].source_url,initial.sourceUrl);
   assert.equal(persisted[0].valid_until,null);
   assert.equal(persisted[1].valid_until?.toISOString().slice(0,10),'2027-12-31');
   assert.equal(persisted[2].valid_until,null);
   assert.ok(persisted.every(x=>/^[a-f0-9]{64}$/.test(x.snapshot_sha256)));
   assert.notEqual(persisted[0].snapshot_sha256,persisted[1].snapshot_sha256);
   const detail=await page('/normativos/'+sourceId,analystA);
   assert.equal(detail.status,200);
   assert.ok(detail.html.includes('Versão 1'));
   assert.ok(detail.html.includes('Versão 2'));
   assert.ok(detail.html.includes('Versão 3'));
   assert.ok(detail.html.includes(initial.excerpt));
   assert.ok(detail.html.includes(update.excerpt));
  });
  await t.test('RLS, consulta histórica por prefeitura e escrita restrita',async()=>{
   assert.equal((await app.query('SELECT * FROM municipal_normative_sources')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[adminB.id]);
    assert.equal((await app.query('SELECT * FROM municipal_normative_sources')).rowCount,0);
    assert.equal((await app.query('SELECT * FROM municipal_normative_versions')).rowCount,0);
    await app.query('SAVEPOINT forbidden');
    await assert.rejects(app.query(
     'UPDATE municipal_normative_versions SET excerpt=$1 WHERE source_id=$2',
     ['Tentativa de alteração silenciosa',sourceId]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT forbidden');
    await app.query('SAVEPOINT forbidden2');
    await assert.rejects(app.query(
     'DELETE FROM municipal_normative_sources WHERE id=$1',[sourceId]),/permission denied/i);
    await app.query('ROLLBACK TO SAVEPOINT forbidden2');
   }finally{await app.query('ROLLBACK');}
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
    const [result]=(await app.query(
     'SELECT COUNT(*)::integer AS n FROM municipal_normative_versions '+
     'WHERE source_id=$1',[sourceId])).rows;
    assert.equal(result.n,3);
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cities.length){
    await admin.query('DELETE FROM municipal_normative_versions WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM municipal_normative_sources WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(people.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[people]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
