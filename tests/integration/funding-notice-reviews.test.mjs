import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {randomUUID} from 'node:crypto';
import {radarReferenceDate} from '../../lib/opportunity-deadline.mjs';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('V1 notice reviews require a disposable database and localhost HTTP');
test('V1-07: independent notice attestation enforces RLS, roles, latest source and documentary evidence',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const webRole=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await webRole.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8),cities=[],users=[],observations=[];
 const secret='CI-Notice-'+tag+'-password',pw=await bcrypt.hash(secret,10);
 const today=radarReferenceDate().toISOString().slice(0,10);
 const plus14=new Date(Date.parse(today+'T00:00:00Z')+14*86400000).toISOString().slice(0,10);
 const prev=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 const older=new Date(Date.parse(today+'T00:00:00Z')-2*86400000).toISOString().slice(0,10);
 async function city(name){
  const id=(await admin.query("INSERT INTO municipalities(name,uf,population) VALUES($1,'SC',10000) RETURNING id",
   ['V1 conferência '+tag+' '+name])).rows[0].id;cities.push(id);return id;
 }
 async function actor(cityId,role,label){
  const email='v1-doc-'+tag+'-'+label+'@example.invalid';
  const id=(await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',[cityId,'Servidor '+label,email,pw,role])).rows[0].id;
  users.push(id);
  const response=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password:secret})});
  assert.equal(response.status,200);
  return {id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 const url='https://www.gov.br/municipio/edital-exemplo-documental-'+tag;
 const evidence={noticeIdentifier:'EDITAL-TESTE-'+tag,noticeUrl:url,
  publicationDate:prev,issuingAgency:'Secretaria Nacional de Teste'};
 async function observation(cityId,author){
  const id=(await admin.query(
   'INSERT INTO funding_observations(municipality_id,source,external_code,title,source_url,modality,'+
   'observation_kind,reference_status,opens_on,closes_on,checked_on,terms,evidence_note,fingerprint,created_by) '+
   "VALUES($1,'other_official',$2,$3,$4,'convenio','oportunidade_conferida','conferida_por_operador',"+
   '$5,$6,$7,$8::jsonb,$9,$10,$11) RETURNING id',
   [cityId,'TEST-'+tag,'Edital sintético para revisão '+tag,url,prev,plus14,prev,
    JSON.stringify({noticeEvidence:evidence,minimumPopulation:5000}),
    'Evidência de testes e homologação local, não uma oportunidade real.',
    'f'.repeat(64),author.id])).rows[0].id;
  observations.push(id);return id;
 }
 const post=(who,body,origin=base)=>fetch(base+'/api/funding/notice-reviews',{method:'POST',
  headers:{origin,'content-type':'application/json',...(who?.cookie?{cookie:who.cookie}:{})},
  body:JSON.stringify(body)});
 const get=who=>fetch(base+'/api/funding/notice-reviews',{
  headers:who?.cookie?{cookie:who.cookie}:{}});
 try{
  const ca=await city('A'),cb=await city('B');
  const author=await actor(ca,'admin','author');
  const second=await actor(ca,'admin','second');
  const analyst=await actor(ca,'analyst','analyst');
  const foreign=await actor(cb,'admin','foreign');
  const id=await observation(ca,author);
  const payload={observationId:id,reviewState:'confirmed_by_reviewer',
   eligibilityState:'potential',officialDocumentUrl:url,reviewedOn:today,
   reason:'Conferência sintética por segundo administrador com referência documental para o CI.',
   requirementsNote:'Verificar população, contrapartida e documentação no edital real antes do protocolo.'};
  await t.test('only second administrator can attest matching primary document',async()=>{
   assert.equal((await post(null,payload)).status,401);
   assert.equal((await post(analyst,payload)).status,403);
   assert.equal((await post(author,payload)).status,409);
   assert.equal((await post(foreign,payload)).status,404);
   assert.equal((await post(second,payload,'https://evil.example')).status,403);
   assert.equal((await post(second,{...payload,municipalityId:cb})).status,400);
   assert.equal((await post(second,{...payload,officialDocumentUrl:
    'https://www.gov.br/municipio/outro-documento'})).status,409);
   const backdated=await post(second,{...payload,reviewedOn:older});
   assert.equal(backdated.status,409);
   assert.equal((await backdated.json()).reason,'data_revisao_incoerente');
   const saved=await post(second,payload);
   assert.equal(saved.status,201);
   const data=await saved.json();assert.equal(data.externallyCertified,false);
   assert.equal((await post(second,payload)).status,409);
  });
  await t.test('tenant separation, invisible rows and immutable records',async()=>{
   const own=await get(second),other=await get(foreign);
   assert.equal(own.status,200);assert.equal(other.status,200);
   const a=await own.json(),b=await other.json();
   assert.equal(a.reviews.length,1);assert.equal(b.reviews.length,0);
   assert.equal(a.summary.independentlyVerifiedByOfficialAuthority,0);
   assert.equal((await webRole.query('SELECT id FROM funding_notice_reviews')).rowCount,0);
   await assert.rejects(webRole.query('DELETE FROM funding_notice_reviews'),/permission denied/i);
   const dashboard=await fetch(base+'/oportunidades/conferidas',{headers:{cookie:second.cookie}});
   assert.equal(dashboard.status,200);
   assert.ok((await dashboard.text()).includes('Parecer municipal de segundo responsável'));
  });
  await t.test('subsequent superseding reference is never presented as a new positive review',async()=>{
   // The original review is retained as an audit snapshot. A changed observation
   // is not automatically covered by that review.
   const nextId=(await admin.query(
    'INSERT INTO funding_observations(municipality_id,source,external_code,title,source_url,modality,'+
    'observation_kind,reference_status,opens_on,closes_on,checked_on,terms,evidence_note,fingerprint,created_by) '+
    "VALUES($1,'other_official',$2,$3,$4,'convenio','programa_observado','atualizacao_necessaria',"+
    '$5,$6,$7,$8::jsonb,$9,$10,$11) RETURNING id',
    [ca,'TEST-'+tag,'Fonte anterior desatualizada '+tag,url,prev,plus14,prev,'{}',
     'Nova revisão do CI que exige verificação do documento oficial.',
     'e'.repeat(64),author.id])).rows[0].id;
   observations.push(nextId);
   const result=await post(analyst,payload);assert.equal(result.status,403);
   const still=await get(second);const data=await still.json();
   assert.equal(data.reviews.length,1);assert.equal(data.reviews[0].observation_id,id);
  });
 }finally{
  try{
   if(cities.length)await admin.query('DELETE FROM funding_notice_reviews WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(cities.length)await admin.query('DELETE FROM funding_observations WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await webRole.end();await admin.end();}
 }
});
