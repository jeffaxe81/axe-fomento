import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF051..065 exige banco e HTTP descartáveis no CI.');

test('AF051..065: jornada de captação privada, evidências, PDF e controles',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],users=[],projects=[];
 const password='Funding-CI-Only-'+tag+'!';
 const hash=await bcrypt.hash(password,10);
 async function city(label){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Captação sintética '+tag+' '+label]);
  cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function actor(m,label,role){
  const email='captacao-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',[m,'Gestor '+label,email,hash,role]);
  users.push(r.rows[0].id);
  const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({email,password})});
  assert.equal(response.status,200);
  return {id:r.rows[0].id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(m,owner,label){
  const r=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',[m,owner.id,'Projeto municipal '+tag+' '+label]);
  projects.push(r.rows[0].id);return r.rows[0].id;
 }
 async function post(path,body,who,origin=base){
  const response=await fetch(base+path,{method:'POST',
   headers:{origin,'content-type':'application/json',...(who?.cookie?{cookie:who.cookie}:{})},
   body:JSON.stringify(body)});
  let data;try{data=await response.json();}catch{data={};}
  return {status:response.status,data};
 }
 async function get(path,who){
  const response=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});return response;
 }
 const observed={
  source:'bndes',externalCode:'TEST-'+tag,title:'Financiamento sintético para infraestrutura',
  sourceUrl:'https://cidades.bndes.gov.br/solucao/urbanizacao-integrada/',
  modality:'credito',observationKind:'oportunidade_conferida',
  referenceStatus:'conferida_por_operador',opensOn:'2026-11-01',
  closesOn:'2026-11-30',checkedOn:'2026-11-06',
  evidenceNote:'Hipótese de teste interna, não há confirmação por banco ou operador externo.',
  terms:{annualRateBps:700,termMonths:120,
   noticeEvidence:{noticeIdentifier:'EDITAL-INTERNO-'+tag,
    noticeUrl:'https://www.bndes.gov.br/wps/portal/site/home/financiamento/linha-exemplo',
    issuingAgency:'Banco de Desenvolvimento Exemplo',
    publicationDate:'2026-11-06'}}
 };
 let a,b,adminA,analystA,adminB,pA,pB,obsId,caseId;
 try{
  a=await city('A');b=await city('B');
  adminA=await actor(a,'admin-a','admin');
  analystA=await actor(a,'analyst-a','analyst');
  adminB=await actor(b,'admin-b','admin');
  pA=await project(a,analystA,'A');pB=await project(b,adminB,'B');
  await t.test('AF-051..054: origem governamental, campos, CSRF e tenant',async()=>{
   assert.equal((await post('/api/funding/observations',observed)).status,401);
   assert.equal((await post('/api/funding/observations',observed,analystA)).status,403);
   assert.equal((await post('/api/funding/observations',observed,adminA,'https://evil.invalid')).status,403);
   assert.equal((await post('/api/funding/observations',{...observed,sourceUrl:'https://evil.invalid'},adminA)).status,400);
   assert.equal((await post('/api/funding/observations',{...observed,observationKind:'programa_observado',municipalityId:b},adminA)).status,400);
   const result=await post('/api/funding/observations',observed,adminA);
   assert.equal(result.status,201);obsId=result.data.id;
   assert.equal((await post('/api/funding/observations',observed,adminA)).status,409);
   const other=await post('/api/funding/observations',observed,adminB);
   assert.equal(other.status,201);assert.notEqual(other.data.id,obsId);
   const visible=await get('/api/funding/observations',analystA);
   assert.equal(visible.status,200);
   assert.ok((await visible.text()).includes(obsId));
   const hidden=await get('/api/funding/observations',adminB);
   assert.equal(hidden.status,200);assert.ok(!(await hidden.text()).includes(obsId));
  });
  await t.test('AF-056: criar candidatura apenas vinculada ao próprio município',async()=>{
   assert.equal((await post('/api/funding/cases',{projectId:pA,observationId:obsId},adminB)).status,409);
   assert.equal((await post('/api/funding/cases',{projectId:pB,observationId:obsId},adminA)).status,409);
   const own=await post('/api/funding/cases',{projectId:pA,observationId:obsId},analystA);
   assert.equal(own.status,201);caseId=own.data.id;
   assert.equal((await post('/api/funding/cases',{projectId:pA,observationId:obsId},analystA)).status,409);
   const detail=await get('/captacao/'+caseId,analystA);
   assert.equal(detail.status,200);
   assert.ok((await detail.text()).includes('Projeto municipal '+tag+' A'));
   assert.equal((await get('/captacao/'+caseId,adminB)).status,404);
   const pdf=await get('/api/funding/dossier/'+caseId,analystA);
   assert.equal(pdf.status,200);assert.ok((pdf.headers.get('content-type')||'').includes('application/pdf'));
   assert.equal((await get('/api/funding/dossier/'+caseId,adminB)).status,404);
  });
  await t.test('AF-058: simulação é hipotética, reproduzível e sem escrita',async()=>{
   const body={principal:'100000.00',annualRateBps:0,months:10,graceMonths:0};
   const r=await post('/api/funding/simulate',body,analystA);
   assert.equal(r.status,200);assert.equal(r.data.scenario.installmentCents,'1000000');
   assert.equal(r.data.officialOffer,false);
   assert.equal((await post('/api/funding/simulate',{...body,principal:'100000,00'},analystA)).status,400);
  });
  const event={caseId,expectedRevision:0,eventKind:'eligibility',
   note:'Análise interna: consultar condições efetivas com financiador e assessoria.',
   evidenceUrl:null,eventDate:null,value:null,content:{capag:'não comprovada'}};
  await t.test('AF-059..064: trilha append-only, roles, versões concorrentes e provas',async()=>{
   assert.equal((await post('/api/funding/events',event)).status,401);
   assert.equal((await post('/api/funding/events',event,adminB)).status,409);
   assert.equal((await post('/api/funding/events',event,analystA,'https://evil.invalid')).status,403);
   assert.equal((await post('/api/funding/events',{...event,eventKind:'award_verification',value:'10.00'},analystA)).status,400);
   const first=await post('/api/funding/events',event,analystA);
   assert.equal(first.status,201);assert.equal(first.data.revision,1);
   assert.equal((await post('/api/funding/events',event,analystA)).status,409);
   const race=await Promise.all([
    post('/api/funding/events',{...event,expectedRevision:1,
     eventKind:'documentation_check'},analystA),
    post('/api/funding/events',{...event,expectedRevision:1,
     eventKind:'dossier'},analystA)
   ]);
   assert.deepEqual(race.map(x=>x.status).sort(),[201,409]);
   const award=await post('/api/funding/events',{...event,expectedRevision:2,
    eventKind:'award_verification',value:'100000.00',
    evidenceUrl:'https://www.gov.br/transferegov/',eventDate:'2026-11-06'},analystA);
   assert.equal(award.status,201);
   const events=await get('/api/funding/events?caseId='+caseId,analystA);
   assert.equal(events.status,200);assert.equal((await events.json()).events.length,3);
   const forbidden=await get('/api/funding/events?caseId='+caseId,adminB);
   assert.equal(forbidden.status,200);assert.equal((await forbidden.json()).events.length,0);
   assert.equal((await app.query('SELECT id FROM funding_case_events')).rowCount,0);
   await assert.rejects(app.query('DELETE FROM funding_case_events WHERE case_id=$1',[caseId]),
    /permission denied/i);
  });
  await t.test('AF-055: assinatura privada sem email automático',async()=>{
   const sub={modality:'credito',daysAhead:30,active:true};
   assert.equal((await post('/api/funding/alerts',sub,analystA)).status,200);
   const alerts=await get('/api/funding/alerts',analystA);
   assert.equal(alerts.status,200);const data=await alerts.json();
   assert.equal(data.delivery,'in_app_on_request');
   assert.ok(data.subscriptions.length>=1);
   assert.equal((await get('/api/funding/alerts',adminB)).status,200);
  });
  await t.test('AF-051..053: referência BNDES e CAPAG nunca afirma edital aberto',async()=>{
   // CAPAG CKAN real must never be contacted by the disposable offline CI suite.
   // Its fixed-origin parser and fetch adapter have mocked unit tests.
   const blocked=await post('/api/funding/sources',{source:'tesouro_capag'},analystA);
   assert.equal(blocked.status,403);
   const bndes=await post('/api/funding/sources',{source:'bndes'},adminA);
   assert.equal(bndes.status,200);assert.ok(bndes.data.observed>=30);
   assert.equal(bndes.data.scope,'referencias_sem_confirmacao_de_oferta');
  });
  await t.test('AF-065: painel separado por município e valores declarados',async()=>{
   const r=await get('/captacao',analystA);assert.equal(r.status,200);
   const html=await r.text();assert.ok(html.includes('Jornada de financiamento municipal'));
   assert.ok(html.includes('Valores aprovados declarados'));
   const other=await get('/captacao',adminB);assert.equal(other.status,200);
   assert.ok(!(await other.text()).includes('Projeto municipal '+tag+' A'));
  });
  await t.test('V1-07: revisão posterior revoga elegibilidade do snapshot anterior para novas candidaturas',async()=>{
   const updated={...observed,
    evidenceNote:'Nova revisão humana, registrada para testar supersessão sem certificar vigência.',
    referenceStatus:'atualizacao_necessaria',
    observationKind:'programa_observado',
    terms:{}};
   const next=await post('/api/funding/observations',updated,adminA);
   assert.equal(next.status,201);
   assert.notEqual(next.data.id,obsId);
   assert.equal((await post('/api/funding/cases',{projectId:pA,observationId:obsId},analystA)).status,409);
   const oldCase=await get('/api/funding/cases',analystA);
   assert.equal(oldCase.status,200);
   const casesData=await oldCase.json();
   assert.equal(casesData.cases.find(x=>x.id===caseId)?.is_superseded,true);
   const detail=await get('/captacao/'+caseId,analystA);
   assert.equal(detail.status,200);
   assert.ok((await detail.text()).includes('versão da fonte substituída'));
   const overview=await get('/captacao',analystA);
   assert.ok((await overview.text()).includes('Referência substituída por versão mais recente'));
  });
 }finally{
  try{await app.query('ROLLBACK')}catch{}
  try{
   if(cities.length){
    await admin.query('DELETE FROM funding_case_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM funding_cases WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM funding_alert_subscriptions WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM funding_observations WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
