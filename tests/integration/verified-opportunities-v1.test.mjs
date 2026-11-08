import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||!process.env.TEST_BASE_URL)
 throw new Error('V1 radar de fontes requer PostgreSQL e HTTP isolados no CI.');
test('V1: radar de referências não promove programas a editais, respeita município e mostra progresso',async t=>{
 const db=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 await db.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cityIds=[],users=[],observations=[];
 const pass='CI-RADAR-EVIDENCIAS-'+tag+'!',passwordHash=await bcrypt.hash(pass,10);
 async function createCity(label){
  const city=(await db.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Observações V1 '+tag+' '+label])).rows[0].id;cityIds.push(city);
  const email='observacoes-v1-'+tag+'-'+label+'@example.invalid';
  const user=(await db.query("INSERT INTO users(municipality_id,full_name,email,password_hash,role) "+
   "VALUES($1,$2,$3,$4,'admin') RETURNING id",[city,'Admin '+label,email,passwordHash])).rows[0].id;
  users.push(user);
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password:pass})});
  assert.equal(login.status,200);
  return {city,user,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function addObservation(actor,title,status,kind,days=14){
  const external='EX-'+randomUUID();
  const r=await db.query(
   'INSERT INTO funding_observations(municipality_id,source,external_code,title,source_url,'+
   'modality,observation_kind,reference_status,opens_on,closes_on,checked_on,'+
   'evidence_note,fingerprint,created_by,terms) VALUES'+
   "($1,'transferegov',$2,$3,'https://api-publica.transferegov.gestao.gov.br/parcerias/programa',"+
   "$4,$5,$6,CURRENT_DATE-1,CURRENT_DATE+$7::int,CURRENT_DATE,"+
   "'Referência municipal sintética de teste que não comprova edital oficial',repeat('a',64),$8,$9::jsonb) RETURNING id",
   [actor.city,external,title,'convenio',kind,status,days,actor.user,
    JSON.stringify(kind==='oportunidade_conferida'?{noticeEvidence:{
     noticeIdentifier:'EDITAL-TESTE-'+external,
     noticeUrl:'https://www.gov.br/municipio/edital-teste-interno-'+external,
     issuingAgency:'Secretaria Municipal de Testes',
     publicationDate:new Date(Date.now()-86400000).toISOString().slice(0,10)
    }}:{})]);
  observations.push(r.rows[0].id);
 }
 async function visit(url,cookie){
  const r=await fetch(base+url,{redirect:'manual',headers:cookie?{cookie}:{}});return {status:r.status,body:await r.text()};
 }
 try{
  const a=await createCity('A'),b=await createCity('B');
  const reviewed='EDITAL REVISADO INTERNO '+tag+' A',program='PROGRAMA SEM EDITAL '+tag+' A';
  const foreign='DADO PRIVADO '+tag+' B';
  await addObservation(a,reviewed,'conferida_por_operador','oportunidade_conferida');
  await addObservation(a,program,'nao_confirmada','programa_observado');
  await addObservation(b,foreign,'conferida_por_operador','oportunidade_conferida');
  await t.test('cada município visualiza apenas suas referências e é necessária sessão',async()=>{
   const own=await visit('/oportunidades/conferidas',a.cookie);
   assert.equal(own.status,200);assert.ok(own.body.includes(reviewed));
   assert.ok(own.body.includes(program));assert.ok(!own.body.includes(foreign));
   const other=await visit('/oportunidades/conferidas',b.cookie);
   assert.equal(other.status,200);assert.ok(other.body.includes(foreign));
   assert.ok(!other.body.includes(reviewed));
   assert.equal((await visit('/oportunidades/conferidas')).status,307);
  });
  await t.test('filtro de vigência não promove programa bruto a edital vigente',async()=>{
   const list=await visit('/oportunidades/conferidas?situacao=current',a.cookie);
   assert.equal(list.status,200);assert.ok(list.body.includes(reviewed));
   assert.ok(!list.body.includes(program));
   assert.ok(list.body.includes('reconfirmar'));
  });
  await t.test('barras de V1 a V4 acessíveis no dashboard e no cronograma',async()=>{
   const overview=await visit('/',a.cookie),progress=await visit('/evolucao',a.cookie);
   assert.equal(overview.status,200);assert.equal(progress.status,200);
   assert.ok(overview.body.includes('Evolução do AXE Fomento'));
   for(const title of ['Radar de oportunidades verificáveis',
    'Inteligência jurídica e preparação com IA','Rede nacional e internacional de fomento',
    'Avaliador inteligente e calibrado'])
    assert.ok(progress.body.includes(title),title);
   assert.ok(progress.body.includes('Marcos de produto concluídos'));
   assert.ok(progress.body.includes('Homologação operacional:'));
  });
 }finally{
  try{
   if(observations.length)await db.query('DELETE FROM funding_observations WHERE id=ANY($1::uuid[])',[observations]);
   if(users.length)await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cityIds.length)await db.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cityIds]);
  }finally{await db.end();}
 }
});
