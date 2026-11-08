import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF-031 exige PostgreSQL e HTTP descartáveis no CI.');

test('AF-031: busca por intenção, isolamento de curadoria e proveniência',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().replace(/-/g,'').slice(0,10);
 const prefix='Semantic'+tag,cityIds=[],userIds=[],oppIds=[],programIds=[];
 const password='Semantic-Tests-Only-2026!',hash=await bcrypt.hash(password,10);
 async function city(label){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Cidade sintética '+prefix+' '+label]);cityIds.push(r.rows[0].id);return r.rows[0].id;
 }
 async function actor(municipality,label,role){
  const email='semantic-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query(
   'INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Analista '+label,email,hash,role]);
  userIds.push(r.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(login.status,200);
  return {id:r.rows[0].id,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function opportunity(title,areas=['Saúde'],created='2026-01-01T01:00:00Z'){
  const r=await admin.query(
   'INSERT INTO opportunities(title,provider,areas,created_at,is_example,source_url) '+
   'VALUES($1,$2,$3,$4,true,$5) RETURNING id',
   [title,'Fonte demonstrativa',areas,created,'https://example.org/teste']);
  oppIds.push(r.rows[0].id);return r.rows[0].id;
 }
 async function program(municipality,who,tagName,status){
  const externalId=prefix+'-'+tagName+'-'+municipality.slice(0,5);
  const title=prefix+' Hospital '+tagName;
  const checksum=createHash('sha256').update(title).digest('hex');
  const r=await admin.query(
   'INSERT INTO source_programs (municipality_id,external_id,title,provider,'+
   'source_url,checksum,review_state,version,reviewed_at,reviewer_id) '+
   'VALUES($1,$2,$3,$4,$5,$6,$7,1,CASE WHEN $7=$8 THEN now() ELSE NULL END,'+
   'CASE WHEN $7=$8 THEN $9::uuid ELSE NULL END) RETURNING id',
   [municipality,externalId,title,'Fonte demonstrativa',
    'https://api-publica.transferegov.gestao.gov.br/parcerias/programa',
    checksum,status,'approved',who.id]);
  programIds.push(r.rows[0].id);
  await admin.query('INSERT INTO source_program_versions '+
   '(program_id,municipality_id,version,checksum,snapshot) '+
   'VALUES($1,$2,1,$3,$4::jsonb)',
   [r.rows[0].id,municipality,checksum,JSON.stringify({title})]);
  if(status==='approved')await admin.query(
   'INSERT INTO source_program_reviews (municipality_id,program_id,version,'+
   'reviewer_id,decision,justification) VALUES($1,$2,1,$3,$4,$5)',
   [municipality,r.rows[0].id,who.id,'approved',
    'Fonte sintética aprovada para fins exclusivos do teste.']);
  return {id:r.rows[0].id,externalId};
 }
 async function get(path,who){
  const r=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});
  const ct=r.headers.get('content-type')||'';
  return {status:r.status,data:ct.includes('json')?await r.json():await r.text(),
   cache:r.headers.get('cache-control')};
 }
 function api(intent,kind='oportunidades',page=1){
  return '/api/opportunities/semantic?'+new URLSearchParams({
   intencao:intent,tipo:kind,pagina:String(page)}).toString();
 }
 try{
  const a=await city('A'),b=await city('B');
  const user=await actor(a,'usuario','analyst');
  const adminA=await actor(a,'admin','admin');
  const adminB=await actor(b,'admin-b','admin');
  for(let i=0;i<30;i++)await opportunity(prefix+' Hospital '+i);
  const old=await opportunity('Rare'+tag+' hospital antigo',['Saúde'],'2000-01-01T01:00:00Z');
  const r=await admin.query(
   "INSERT INTO opportunities(title,provider,created_at,is_example) "+
   "SELECT $1||' preenchimento '||n::text,'Outro', '2025-01-01Z', true "+
   'FROM generate_series(1,110) AS n RETURNING id',[prefix]);
  oppIds.push(...r.rows.map(x=>x.id));
  const approvedA=await program(a,adminA,'aprovado','approved');
  const pendingA=await program(a,adminA,'pendente','pending');
  const rejectedA=await program(a,adminA,'rejeitado','rejected');
  const approvedB=await program(b,adminB,'fora','approved');

  await t.test('busca por intenção + sinônimo, paginação pós-relevância e histórico antigo',async()=>{
   const a1=await get(api('postos de saúde '+prefix),user);
   assert.equal(a1.status,200);
   assert.equal(a1.data.kind,'oportunidades');
   assert.equal(a1.data.method,'controlled-intents-pt-v1');
   assert.equal(a1.data.items.length,25);
   assert.equal(a1.data.hasNext,true);
   assert.ok(a1.data.items.some(x=>x.title.includes('Hospital')));
   assert.ok(a1.data.items.every(x=>x.relevance>0&&x.is_example));
   const a2=await get(api('postos de saúde '+prefix,'oportunidades',2),user);
   assert.equal(a2.status,200);
   assert.ok(a2.data.items.length>0);
   assert.ok(!a2.data.items.some(x=>a1.data.items.some(y=>y.id===x.id)));
   const school=await opportunity(prefix+' Educação Básica',['Educação']);
   const e=await get(api('creches '+prefix),user);
   assert.equal(e.status,200);
   assert.ok(e.data.items.some(x=>x.id===school),
    'Busca por creches deve recuperar educação por intenção temática');
   const rare=await get(api('Rare'+tag),user);
   assert.equal(rare.status,200);
   assert.equal(rare.data.items[0].id,old,
    'O item antigo é buscado no corpus inteiro, não só nos 100 últimos');
   const empty=await get(api('NuncaEncontrado'+tag),user);
   assert.equal(empty.status,200);assert.equal(empty.data.items.length,0);
  });
  await t.test('fonte curada de um município, pendente e rejeitada sempre ocultas',async()=>{
   const own=await get(api(prefix,'programas'),user);
   assert.equal(own.status,200);
   assert.equal(own.data.kind,'programas');
   assert.deepEqual(own.data.items.map(p=>p.id),[approvedA.id]);
   assert.ok(own.data.items[0].last_seen_at);
   assert.equal(own.data.items.some(p=>[pendingA.id,rejectedA.id,approvedB.id].includes(p.id)),false);
   assert.match(own.data.provenance,/revisão municipal/);
   const foreign=await get(api(prefix,'programas'),adminB);
   assert.deepEqual(foreign.data.items.map(p=>p.id),[approvedB.id]);
   const html=await get('/oportunidades/semantica?intencao='+prefix+'&tipo=programas',user);
   assert.equal(html.status,200);
   assert.ok(html.data.includes(approvedA.externalId));
   assert.ok(!html.data.includes(pendingA.externalId));
   assert.ok(!html.data.includes(approvedB.externalId));
   assert.ok(html.data.includes('Programa revisado, não edital aberto'));
  });
  await t.test('sessão, controle de input, páginas limitadas e proveniência honesta',async()=>{
   assert.equal((await get(api(prefix))).status,401);
   assert.equal((await get('/oportunidades/semantica?intencao='+prefix)).status,307);
   assert.equal((await get(api('%_?','programas'),user)).status,400);
   assert.equal((await get(api('x'.repeat(121),'programas'),user)).status,400);
   const attack=await get(api('hospital or 1=1 --','programas'),user);
   assert.equal(attack.status,200);assert.ok(attack.data.items.length<=1);
   const badPage=await get(api(prefix,'programas',99999),user);
   assert.equal(badPage.status,200);assert.equal(badPage.data.page,1);
   assert.equal(badPage.cache,'no-store');
   const html=await get('/oportunidades/semantica?intencao='+encodeURIComponent(prefix),user);
   assert.equal(html.status,200);
   assert.ok(html.data.includes('data-semantic-id='));
   assert.ok(html.data.includes('Data de consulta à fonte: não disponível'));
  });
  await t.test('RLS protege consulta e identidade municipal das fontes',async()=>{
   assert.equal((await app.query('SELECT * FROM source_programs')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    assert.equal((await app.query('SELECT * FROM source_programs WHERE id=$1',
     [approvedA.id])).rowCount,0);
    assert.equal((await app.query('SELECT * FROM source_programs WHERE id=$1',
     [approvedB.id])).rowCount,1);
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cityIds.length){
    await admin.query('DELETE FROM source_program_reviews WHERE municipality_id=ANY($1::uuid[])',[cityIds]);
    await admin.query('DELETE FROM source_program_versions WHERE municipality_id=ANY($1::uuid[])',[cityIds]);
    await admin.query('DELETE FROM source_programs WHERE municipality_id=ANY($1::uuid[])',[cityIds]);
   }
   if(oppIds.length)
    await admin.query('DELETE FROM opportunities WHERE id=ANY($1::uuid[])',[oppIds]);
   if(cityIds.length)await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cityIds]);
   if(userIds.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[userIds]);
   if(cityIds.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cityIds]);
  }finally{await app.end();await admin.end();}
 }
});
