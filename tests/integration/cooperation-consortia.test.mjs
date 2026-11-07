import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('AF-037..040 exige PostgreSQL e API HTTP descartáveis.');

test('AF-037/038/039/040: fomento internacional e consórcios sem vazamento intermunicipal',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const municipalities=[],users=[],projects=[];
 const password='80Percent-OnlyCI-2026!',hash=await bcrypt.hash(password,10);
 async function tenant(label){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Consórcio AF040 '+tag+' '+label]);
  municipalities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function user(tenantId,label,role){
  const email='consorcio-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query(
   'INSERT INTO users(municipality_id,full_name,email,password_hash,role)'+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [tenantId,'Operador Consórcio '+label,email,hash,role]);
  users.push(r.rows[0].id);
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({email,password})});
  assert.equal(login.status,200);return {id:r.rows[0].id,
   cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(municipality,actor,label){
  const r=await admin.query(
   'INSERT INTO projects(municipality_id,owner_user_id,title) VALUES($1,$2,$3) RETURNING id',
   [municipality,actor.id,'Título PRIVADO da carteira '+tag+' '+label]);
  projects.push(r.rows[0].id);return r.rows[0].id;
 }
 async function post(path,body,actor,origin=base){
  const response=await fetch(base+path,{method:'POST',
   headers:{origin,'content-type':'application/json',
    ...(actor?.cookie?{cookie:actor.cookie}:{})},
   body:JSON.stringify(body)});
  const raw=await response.text();let data;
  try{data=JSON.parse(raw);}catch{data={error:raw.slice(0,120)};}
  return {status:response.status,data};
 }
 async function get(path,actor){
  const response=await fetch(base+path,{redirect:'manual',
   headers:actor?.cookie?{cookie:actor.cookie}:{}});
  return {status:response.status,html:await response.text()};
 }
 const callBody={code:'INT-'+tag.toUpperCase(),title:'Referencia institucional internacional '+tag,
  institution:'Banco Interamericano de Desenvolvimento',language:'en',
  scope:'international',modality:'loan',
  officialUrl:'https://www.iadb.org/en/who-we-are/country-offices/brazil',
  reviewState:'to_verify',checkedOn:null,
  notes:'Registro manual de referência; não há comprovação de chamada pública aberta.'};
 const routeBody={callId:'',routeType:'to_confirm',
  contactName:'Escritório nacional institucional',
  contactUrl:'https://www.iadb.org/en/who-we-are/country-offices/brazil',
  verification:'reported',checkedOn:null,
  applicationSteps:'Conferir a página oficial e validar o procedimento de contato institucional.'};
 const paths={
  call:'/api/cooperation/calls',route:'/api/cooperation/routes',
  consortium:'/api/consortia',invite:'/api/consortia/invitations',
  membership:'/api/consortia/membership-state',
  share:'/api/consortia/shares',revoke:'/api/consortia/shares/revoke'
 };
 let a,b,c,adminA,ownerA,adminB,analystB,adminC,projectA,projectA2;
 let consortiumId,memberId,shareId,secondShareId;
 try{
  a=await tenant('A');b=await tenant('B');c=await tenant('C');
  adminA=await user(a,'admin-a','admin');
  ownerA=await user(a,'owner-a','analyst');
  adminB=await user(b,'admin-b','admin');
  analystB=await user(b,'analyst-b','analyst');
  adminC=await user(c,'admin-c','admin');
  projectA=await project(a,ownerA,'Principal');
  projectA2=await project(a,ownerA,'Adicional');
  await t.test('AF-037: fonte internacional documentada e RLS municipal',async()=>{
   assert.equal((await post(paths.call,callBody)).status,401);
   assert.equal((await post(paths.call,callBody,ownerA)).status,403);
   assert.equal((await post(paths.call,callBody,adminA,'https://attacker.invalid')).status,403);
   assert.equal((await post(paths.call,{...callBody,municipalityId:b},adminA)).status,400);
   assert.equal((await post(paths.call,{...callBody,officialUrl:'http://www.iadb.org'},adminA)).status,422);
   assert.equal((await post(paths.call,{...callBody,reviewState:'checked_reference'},adminA)).status,422);
   const r=await post(paths.call,callBody,adminA);
   assert.equal(r.status,201);routeBody.callId=r.data.id;
   assert.ok(routeBody.callId);
   assert.equal((await post(paths.call,callBody,adminA)).status,409);
   const list=await get('/cooperacao',adminA);
   assert.equal(list.status,200);
   assert.ok(list.html.includes(callBody.code));
   assert.ok(list.html.includes('não são chamadas abertas'));
   const foreign=await get('/cooperacao',adminB);
   assert.equal(foreign.status,200);
   assert.ok(!foreign.html.includes(callBody.code));
  });
  await t.test('AF-038: rota documental restrita ao município que criou a fonte',async()=>{
   assert.equal((await post(paths.route,routeBody)).status,401);
   assert.equal((await post(paths.route,routeBody,ownerA)).status,403);
   assert.equal((await post(paths.route,routeBody,adminB)).status,404);
   assert.equal((await post(paths.route,{...routeBody,verification:'checked_internally'},adminA)).status,422);
   assert.equal((await post(paths.route,{...routeBody,contactUrl:'https://localhost/teste'},adminA)).status,422);
   const r=await post(paths.route,routeBody,adminA);
   assert.equal(r.status,201);assert.ok(r.data.id);
   assert.equal((await post(paths.route,routeBody,adminA)).status,409);
   const page=await get('/cooperacao',adminA);
   assert.ok(page.html.includes('Escritório nacional institucional'));
   assert.ok(page.html.includes('Rota a confirmar'));
   assert.ok(!(await get('/cooperacao',adminB)).html.includes('Escritório nacional institucional'));
  });
  await t.test('AF-039: convite do fundador, aceite exclusivo do município destinatário',async()=>{
   assert.equal((await post(paths.consortium,{title:'Consórcio de Fomento '+tag,
    purpose:'Cooperação no planejamento e estudo de políticas públicas.'},ownerA)).status,403);
   const created=await post(paths.consortium,{title:'Consórcio de Fomento '+tag,
    purpose:'Cooperação no planejamento e estudo de políticas públicas.'},adminA);
   assert.equal(created.status,201);consortiumId=created.data.id;
   const directory=await get('/consorcios/'+consortiumId,adminA);
   assert.equal(directory.status,200);
   assert.ok(directory.html.includes('Consórcio de Fomento'));
   assert.ok(directory.html.includes('Consórcio AF040 '+tag+' B'));
   const invitation={consortiumId,municipalityId:b,
    note:'Convite formal para cooperação intermunicipal em projetos locais.'};
   assert.equal((await post(paths.invite,invitation,ownerA)).status,403);
   assert.equal((await post(paths.invite,invitation,adminB)).status,404);
   const invite=await post(paths.invite,invitation,adminA);
   assert.equal(invite.status,201);memberId=invite.data.membershipId;
   assert.equal(invite.data.state,'invited');
   assert.equal((await post(paths.invite,invitation,adminA)).status,409);
   assert.equal((await get('/consorcios/'+consortiumId,adminC)).status,404);
   const guest=await get('/consorcios',adminB);
   assert.equal(guest.status,200);
   const dbMember=(await admin.query(
    'SELECT id,state,owner_municipality_id,member_municipality_id FROM consortium_memberships WHERE id=$1',
    [memberId])).rows[0];
   await app.query('BEGIN');
   let diagnostic;
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[adminB.id]);
    const r1=await app.query('SELECT id,state FROM consortium_memberships WHERE id=$1',[memberId]);
    const r2=await app.query('SELECT id,title FROM municipal_consortia WHERE id=$1',[consortiumId]);
    diagnostic={memberRows:r1.rows,consortiaRows:r2.rows};
   }finally{await app.query('ROLLBACK');}
   console.log('AF039_DIAG',JSON.stringify({dbMember,diagnostic,
    hasTitle:guest.html.includes('Consórcio de Fomento'),
    hasAccept:guest.html.includes('Aceitar convite'),
    hasEmpty:guest.html.includes('Nenhum consórcio ou convite'),
    status:guest.status}));
   assert.ok(guest.html.includes('Consórcio de Fomento'));
   assert.ok(guest.html.includes('Aceitar convite'));
   assert.equal((await post(paths.membership,{membershipId:memberId,
    action:'accept',expectedRevision:1,note:'Adesão autorizada pelo administrador.'},adminA)).status,409);
   assert.equal((await post(paths.membership,{membershipId:memberId,
    action:'accept',expectedRevision:1,note:'Adesão autorizada pelo administrador.'},analystB)).status,403);
   const accepted=await post(paths.membership,{membershipId:memberId,
    action:'accept',expectedRevision:1,
    note:'Prefeitura convidada autorizou participação com aceite registrado.'},adminB);
   assert.equal(accepted.status,201);
   assert.equal((await post(paths.membership,{membershipId:memberId,
    action:'accept',expectedRevision:1,
    note:'Aceite antigo não pode ser repetido.'},adminB)).status,409);
   const current=(await admin.query(
    'SELECT state,revision FROM consortium_memberships WHERE id=$1',[memberId])).rows[0];
   assert.equal(current.state,'active');assert.equal(current.revision,2);
   assert.deepEqual((await admin.query(
    'SELECT action FROM consortium_membership_events WHERE membership_id=$1 ORDER BY revision',
    [memberId])).rows.map(x=>x.action),['invited','accepted']);
  });
  const share=(projectId,title)=>({
   consortiumId,projectId,publicTitle:title,
   sharedSummary:'Resumo selecionado pela equipe do município fundador. Não contém carteira completa, '+
    'orçamento individualizado, nomes pessoais nem anexo sensível para cooperação técnica.',
   note:'Divulgação limitada deste resumo ao consórcio com adesão institucional.'
  });
  await t.test('AF-040: resumo não herda direitos aos projetos, e revogação bloqueia URL direta',async()=>{
   const body=share(projectA,'Resumo público controlado '+tag);
   assert.equal((await post(paths.share,body,adminB)).status,404);
   assert.equal((await post(paths.share,{...body,projectId:randomUUID()},ownerA)).status,404);
   const r=await post(paths.share,body,ownerA);
   assert.equal(r.status,201);shareId=r.data.id;
   assert.equal(r.data.sharedScope,'somente_resumo_autorizado');
   const shared=await get('/consorcios/compartilhados/'+shareId,adminB);
   assert.equal(shared.status,200);
   assert.ok(shared.html.includes(body.publicTitle));
   assert.ok(shared.html.includes('Resumo selecionado pela equipe'));
   assert.ok(!shared.html.includes('Título PRIVADO da carteira'));
   assert.equal((await get('/consorcios/compartilhados/'+shareId,analystB)).status,404);
   assert.equal((await get('/consorcios/compartilhados/'+shareId,adminC)).status,404);
   assert.equal((await get('/projetos/'+projectA,adminB)).status,404);
   assert.equal((await get('/projetos/'+projectA+'/documentos',adminB)).status,404);
   assert.equal((await post(paths.share,body,ownerA)).status,409);
   assert.equal((await post(paths.revoke,{shareId,expectedRevision:1,
    note:'Revogação administrativa pela prefeitura participante.'},adminB)).status,409);
   const revoked=await post(paths.revoke,{shareId,expectedRevision:1,
    note:'Município fundador encerrou a autorização específica deste resumo.'},ownerA);
   assert.equal(revoked.status,201);assert.equal(revoked.data.enabled,false);
   assert.equal((await get('/consorcios/compartilhados/'+shareId,adminB)).status,404);
   assert.equal((await post(paths.revoke,{shareId,expectedRevision:1,
    note:'Repetição da mesma revogação não autorizada.'},ownerA)).status,409);
   const ownerView=await get('/consorcios/compartilhados/'+shareId,ownerA);
   assert.equal(ownerView.status,200);
   assert.ok(ownerView.html.includes('Autorização foi revogada')||
    ownerView.html.includes('autorização foi revogada'));
  });
  await t.test('AF-039/040: revogar adesão corta acesso mesmo com resumo habilitado',async()=>{
   const newer=await post(paths.share,share(projectA2,'Novo resumo controlado '+tag),ownerA);
   assert.equal(newer.status,201);secondShareId=newer.data.id;
   assert.equal((await get('/consorcios/compartilhados/'+secondShareId,adminB)).status,200);
   const r=await post(paths.membership,{membershipId:memberId,expectedRevision:2,
    action:'revoke',note:'Revogação de participação pelo município fundador.'},adminA);
   assert.equal(r.status,201);
   assert.equal((await get('/consorcios/compartilhados/'+secondShareId,adminB)).status,404);
   assert.equal((await get('/consorcios/'+consortiumId,adminB)).status,404);
   assert.equal((await get('/consorcios/compartilhados/'+secondShareId,adminC)).status,404);
   const other=(await admin.query(
    'SELECT state,revision FROM consortium_memberships WHERE id=$1',[memberId])).rows[0];
   assert.equal(other.state,'revoked');assert.equal(other.revision,3);
   assert.deepEqual((await admin.query(
    'SELECT action FROM consortium_membership_events WHERE membership_id=$1 ORDER BY revision',
    [memberId])).rows.map(x=>x.action),['invited','accepted','revoked']);
   assert.equal((await admin.query(
    'SELECT count(*)::integer AS n FROM consortium_share_events '+
    'WHERE share_id=ANY($1::uuid[])',[[shareId,secondShareId]])).rows[0].n,3);
  });
  await t.test('role web não altera logs nem acessa carteira de outro tenant',async()=>{
   assert.equal((await app.query('SELECT * FROM consortium_share_events')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[adminB.id]);
    assert.equal((await app.query(
     'SELECT * FROM international_cooperation_calls WHERE municipality_id=$1',[a])).rowCount,0);
    assert.equal((await app.query(
     'SELECT * FROM international_application_routes WHERE municipality_id=$1',[a])).rowCount,0);
    assert.equal((await app.query(
     'SELECT * FROM consortium_project_shares WHERE id=$1',[secondShareId])).rowCount,0);
    assert.equal((await app.query(
     'SELECT * FROM projects WHERE id=$1',[projectA])).rowCount,0);
    for(const sql of [
     'DELETE FROM consortium_membership_events WHERE membership_id=$1',
     "UPDATE consortium_membership_events SET note='Alterada' WHERE membership_id=$1",
     'DELETE FROM consortium_share_events WHERE share_id=$1',
     "UPDATE consortium_project_shares SET shared_summary='Violação' WHERE id=$1"
    ]){
     await app.query('SAVEPOINT denied');
     await assert.rejects(app.query(sql,[memberId]),/permission denied/i);
     await app.query('ROLLBACK TO SAVEPOINT denied');
    }
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(municipalities.length){
    await admin.query('DELETE FROM consortium_share_events WHERE owner_municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await admin.query('DELETE FROM consortium_project_shares WHERE owner_municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await admin.query('DELETE FROM consortium_membership_events WHERE owner_municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await admin.query('DELETE FROM consortium_memberships WHERE owner_municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await admin.query('DELETE FROM municipal_consortia WHERE owner_municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await admin.query('DELETE FROM international_application_routes WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
    await admin.query('DELETE FROM international_cooperation_calls WHERE municipality_id=ANY($1::uuid[])',
     [municipalities]);
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(municipalities.length)await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',
    [municipalities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(municipalities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',
    [municipalities]);
  }finally{await app.end();await admin.end();}
 }
});
