import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF-035 exige PostgreSQL e servidor HTTP descartáveis.');

test('AF-035: 37 fontes BNDES, triagem em lote, concorrência, fontes e tenant',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],users=[],apiPath='/api/bndes-cidades/reviews/batch';
 const pass='Only-AF035-Integration-CI!',hash=await bcrypt.hash(pass,10);
 async function city(label){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['BNDES TESTE '+tag+' '+label]);cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function user(municipality,label,role){
  const email='bndes-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query(
   'INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Revisor BNDES '+label,email,hash,role]);
  users.push(r.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({email,password:pass})
  });
  assert.equal(login.status,200);
  return {id:r.rows[0].id,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function post(items,who,origin=base){
  const response=await fetch(base+apiPath,{
   method:'POST',
   headers:{origin,'content-type':'application/json',
    ...(who?.cookie?{cookie:who.cookie}:{})},
   body:JSON.stringify({items})});
  const txt=await response.text();let data;
  try{data=JSON.parse(txt);}catch{data={error:txt.slice(0,200)};}
  return {status:response.status,data};
 }
 async function get(path,who){
  const res=await fetch(base+path,{
   redirect:'manual',headers:who?.cookie?{cookie:who.cookie}:{}});
  return {status:res.status,html:await res.text()};
 }
 const observation=(code,revision=0,other={})=>({
  code,expectedRevision:revision,sourceState:'pagina_conferida',
  availabilityState:'nao_apurada',checkedOn:'2026-10-30',
  note:'Conferência sintética de URL BNDES, sem validação de disponibilidade de recursos.',
  acknowledgedLimits:true,...other
 });
 let a,b,adminA,analystA,adminB;
 const code='urbanizacao-integrada';
 try{
  a=await city('A');b=await city('B');
  adminA=await user(a,'admin-a','admin');
  analystA=await user(a,'analyst-a','analyst');
  adminB=await user(b,'admin-b','admin');
  await t.test('37 referências reais imutáveis, filtros e paginação',async()=>{
   const rows=(await admin.query('SELECT code,title,source_url,area,source_scope '+
    'FROM bndes_city_solutions ORDER BY code')).rows;
   assert.equal(rows.length,37);
   assert.ok(rows.every(r=>r.source_url.startsWith(
    'https://cidades.bndes.gov.br/solucao/')));
   assert.ok(rows.every(r=>r.source_scope==='official_page_identified'));
   assert.equal(new Set(rows.map(r=>r.source_url)).size,37);
   assert.ok(rows.some(r=>r.code==='centro-integrado-de-comando-e-controle'));
   assert.ok(rows.some(r=>r.code==='bndes-maquinas-e-servicos-rede-de-frios-para-imunizantes'));
   const full=await get('/bndes-cidades',analystA);
   assert.equal(full.status,200);
   assert.ok(full.html.includes('Catálogo BNDES Cidades'));
   assert.ok(full.html.includes('37'));
   assert.equal((full.html.match(/data-bndes-code="/g)||[]).length,25);
   assert.ok(full.html.includes('pagina=2'));
   const next=await get('/bndes-cidades?pagina=2',analystA);
   assert.equal(next.status,200);
   assert.equal((next.html.match(/data-bndes-code="/g)||[]).length,12);
   const target=await get('/bndes-cidades?area=saude',analystA);
   assert.equal(target.status,200);
   assert.ok(target.html.includes('Saúde'));
   assert.ok(!target.html.includes('data-bndes-code="urbanizacao-integrada"'));
   const literal=await get('/bndes-cidades?busca=100%25_',analystA);
   assert.equal(literal.status,200);
   assert.ok(literal.html.includes('Não há referências'));
   const detail=await get('/bndes-cidades/'+code,analystA);
   assert.equal(detail.status,200);
   assert.ok(detail.html.includes('Urbanização integrada'));
   assert.ok(detail.html.includes('https://cidades.bndes.gov.br/solucao/urbanizacao-integrada/'));
   assert.equal((await get('/bndes-cidades/codigo-nao-existe',analystA)).status,404);
   assert.equal((await get('/bndes-cidades')).status,307);
  });
  await t.test('segurança HTTP, estados controlados e revisão única',async()=>{
   const value=observation(code);
   assert.equal((await post([value])).status,401);
   assert.equal((await post([value],analystA)).status,403);
   assert.equal((await post([value],adminA,'https://attacker.invalid')).status,403);
   assert.equal((await post([value,{...value}],adminA)).status,400);
   assert.equal((await post([],adminA)).status,400);
   assert.equal((await post(Array.from({length:21},(_,i)=>({
    ...value,code:'unico-'+i+'-codigo'
   })),adminA)).status,400);
   assert.equal((await post([{...value,municipalityId:b}],adminA)).status,400);
   assert.equal((await post([{...value,sourceUrl:'https://attacker.invalid'}],adminA)).status,400);
   assert.equal((await post([{...value,note:'curta'}],adminA)).status,400);
   assert.equal((await post([{...value,acknowledgedLimits:false}],adminA)).status,400);
   assert.equal((await post([{...value,checkedOn:'2027-01-01'}],adminA)).status,422);
   assert.equal((await post([{...value,checkedOn:'2026-02-30'}],adminA)).status,422);
   assert.equal((await post([{...value,availabilityState:'aberta'}],adminA)).status,400);
   assert.equal((await post([{...value,sourceState:'pagina_indisponivel',
    availabilityState:'possibilidade_mencionada'}],adminA)).status,422);
   assert.equal((await post([observation('fonte-inexistente')],adminA)).status,404);
   assert.equal((await post([value],adminA)).status,201);
   assert.equal((await post([value],adminA)).status,409);
   const stored=(await admin.query(
    'SELECT revision,checked_on,source_url_snapshot,snapshot_sha256,'+
    'reviewer_id,municipality_id FROM municipal_bndes_review_events '+
    'WHERE municipality_id=$1 AND solution_code=$2',[a,code])).rows[0];
   assert.equal(stored.revision,1);
   assert.equal(stored.reviewer_id,adminA.id);
   assert.equal(stored.municipality_id,a);
   assert.ok(stored.source_url_snapshot.endsWith('/urbanizacao-integrada/'));
   assert.match(stored.snapshot_sha256,/^[0-9a-f]{64}$/);
   assert.equal((await get('/bndes-cidades/'+code,analystA)).html.includes(
    'data-bndes-revision="1"'),true);
  });
  await t.test('escrita em lote de 20 e falha fechada para qualquer item stale',async()=>{
   const codes=(await admin.query('SELECT code FROM bndes_city_solutions ORDER BY code LIMIT 20'))
    .rows.map(r=>r.code);
   assert.equal(codes.length,20);
   const ver=async c=>Number((await admin.query(
    'SELECT count(*)::integer AS n FROM municipal_bndes_review_events '+
    'WHERE municipality_id=$1 AND solution_code=$2',[a,c])).rows[0].n);
   const items=[];
   for(const c of codes)items.push(observation(c,await ver(c),{
    sourceState:'atualizacao_pendente',
    note:'Conferência em lote sem afirmar elegibilidade, taxas ou oferta presente no BNDES.'
   }));
   const written=await post(items,adminA);
   assert.equal(written.status,201);
   assert.equal(written.data.saved,20);
   const total=(await admin.query(
    'SELECT count(*)::integer AS n FROM municipal_bndes_review_events '+
    'WHERE municipality_id=$1',[a])).rows[0].n;
   assert.equal(total,21);
   for(const c of codes)assert.ok((await ver(c))>=1);
   const before=(await admin.query(
    'SELECT count(*)::integer AS n FROM municipal_bndes_review_events '+
    'WHERE municipality_id=$1',[a])).rows[0].n;
   assert.equal((await post(items,adminA)).status,409);
   const after=(await admin.query(
    'SELECT count(*)::integer AS n FROM municipal_bndes_review_events '+
    'WHERE municipality_id=$1',[a])).rows[0].n;
   assert.equal(after,before,'um lote obsoleto não pode salvar qualquer item');
   const checked=await get('/bndes-cidades?conferida=sim',analystA);
   assert.equal(checked.status,200);
   const notChecked=await get('/bndes-cidades?conferida=nao',analystA);
   assert.equal(notChecked.status,200);
   assert.ok(!notChecked.html.includes('data-bndes-code="'+code+'"'));
   const needReview=await get('/bndes-cidades?fonte=atualizacao_pendente',analystA);
   assert.equal(needReview.status,200);
   assert.ok(needReview.html.includes('Fonte exige nova conferência'));
  });
  await t.test('concorrência de lote e revisão pontual é serializada',async()=>{
   const list=['urbanizacao-integrada','mobilidade-urbana'];
   const current=[];
   for(const code of list)current.push(Number((await admin.query(
    'SELECT coalesce(max(revision),0)::integer AS n FROM municipal_bndes_review_events '+
    'WHERE municipality_id=$1 AND solution_code=$2',[a,code])).rows[0].n));
   const batch=list.map((x,i)=>observation(x,current[i],{
    note:'Atualização de lote concorrente do catálogo oficial consultado pela equipe.'
   }));
   const [one,two]=await Promise.all([
    post(batch,adminA),post([batch[0]],adminA)
   ]);
   assert.deepEqual([one.status,two.status].sort(),[201,409]);
   const after=[];
   for(const code of list)after.push(Number((await admin.query(
    'SELECT coalesce(max(revision),0)::integer AS n FROM municipal_bndes_review_events '+
    'WHERE municipality_id=$1 AND solution_code=$2',[a,code])).rows[0].n));
   assert.equal(after[0],current[0]+1);
   assert.ok(after[1]===current[1]||after[1]===current[1]+1);
   if(after[1]===current[1]){
    assert.equal(one.status,409);
    assert.equal(two.status,201);
   }
  });
  await t.test('RLS isola prefeituras e role web não sobrescreve histórico',async()=>{
   assert.equal((await app.query('SELECT * FROM municipal_bndes_review_events')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[adminB.id]);
    assert.equal((await app.query('SELECT * FROM municipal_bndes_review_events')).rowCount,0);
    for(const sql of [
     'DELETE FROM municipal_bndes_review_events WHERE municipality_id=$1',
     "UPDATE municipal_bndes_review_events SET note='Adulterado' WHERE municipality_id=$1"
    ]){
     await app.query('SAVEPOINT prohibited');
     await assert.rejects(app.query(sql,[a]),/permission denied/i);
     await app.query('ROLLBACK TO SAVEPOINT prohibited');
    }
   }finally{await app.query('ROLLBACK');}
   const foreign=await get('/bndes-cidades/'+code,adminB);
   assert.equal(foreign.status,200,'o catálogo de referências é público para ambos');
   assert.ok(!foreign.html.includes('data-bndes-revision="1"'),
    'mas revisões da outra prefeitura são privadas');
   const foreignNote=await post([observation(code)],adminB);
   assert.equal(foreignNote.status,201);
   const events=(await admin.query(
    'SELECT municipality_id,solution_code,revision FROM municipal_bndes_review_events '+
    'WHERE solution_code=$1 ORDER BY municipality_id,revision',[code])).rows;
   assert.equal(events.filter(x=>x.municipality_id===b).length,1);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
    const count=await app.query(
     'SELECT count(*)::integer AS n FROM municipal_bndes_review_events WHERE municipality_id=$1',[a]);
    assert.ok(count.rows[0].n>=21);
   }finally{await app.query('ROLLBACK');}
  });
  await t.test('leituras simultâneas são seguras com pool limitado',async()=>{
   const requests=await Promise.all(Array.from({length:24},()=>get(
    '/bndes-cidades?area=saude',analystA)));
   assert.ok(requests.every(r=>r.status===200));
   assert.ok(requests.every(r=>r.html.includes('Catálogo BNDES Cidades')));
  });
 }finally{
  try{
   if(cities.length)await admin.query(
    'DELETE FROM municipal_bndes_review_events WHERE municipality_id=ANY($1::uuid[])',
    [cities]);
   if(cities.length)await admin.query(
    'DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query(
    'DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
