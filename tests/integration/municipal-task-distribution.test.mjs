import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {todaySaoPaulo} from '../../lib/document-validity.mjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
  !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('AF-020 exige banco e serviço HTTP de testes descartáveis.');

test('AF-020: secretarias, equipe, tarefas, transferência e auditoria isoladas',async(t)=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const restricted=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await restricted.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],users=[],projects=[];
 const pwd='Somente-Testes-Tarefas-2026!';
 const passwordHash=await bcrypt.hash(pwd,10);
 const date=(n)=>new Date(Date.parse(todaySaoPaulo()+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 const due=date(10),changedDue=date(20);
 async function city(label){
  const r=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Tarefas-'+tag+'-'+label]);
  cities.push(r.rows[0].id);return r.rows[0].id;
 }
 async function actor(tenant,label,role){
  const email='tarefas-'+tag+'-'+label+'@example.invalid';
  const r=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [tenant,'Servidor '+label,email,passwordHash,role]);
  const id=r.rows[0].id;users.push(id);
  const auth=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({email,password:pwd})});
  assert.equal(auth.status,200);
  return {id,tenant,cookie:auth.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(tenant,owner,label){
  const r=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',[tenant,owner,'Candidatura '+tag+' '+label]);
  projects.push(r.rows[0].id);return r.rows[0].id;
 }
 async function api(method,path,data,person,origin=base){
  const res=await fetch(base+path,{method,headers:{'content-type':'application/json',
   origin,...(person?.cookie?{cookie:person.cookie}:{})},body:JSON.stringify(data)});
  return {status:res.status,body:await res.json()};
 }
 async function page(path,person){
  const response=await fetch(base+path,{redirect:'manual',
   headers:person?.cookie?{cookie:person.cookie}:{}});
  return {status:response.status,html:await response.text(),location:response.headers.get('location')};
 }
 const path='/api/projects/tasks',change='/api/projects/tasks/change';
 let deptA,deptB,taskA,taskB;
 try{
  const tenantA=await city('A'),tenantB=await city('B');
  const ownerA=await actor(tenantA,'admin-a','admin');
  const analyst=await actor(tenantA,'analista-a','analyst');
  const outsider=await actor(tenantA,'sem-vinculo-a','analyst');
  const ownerB=await actor(tenantB,'admin-b','admin');
  const projectA=await project(tenantA,analyst.id,'A');
  const projectB=await project(tenantB,ownerB.id,'B');

  await t.test('secretarias são isoladas, apenas administradores as cadastram',async()=>{
   const payload={name:'Secretaria de Planejamento '+tag};
   assert.equal((await api('POST','/api/secretariats',payload)).status,401);
   assert.equal((await api('POST','/api/secretariats',payload,analyst)).status,403);
   assert.equal((await api('POST','/api/secretariats',{...payload,municipalityId:tenantB},ownerA)).status,400);
   assert.equal((await api('POST','/api/secretariats',payload,ownerA,'https://intruso.invalid')).status,403);
   assert.equal((await api('POST','/api/secretariats',{name:'a'},ownerA)).status,400);
   const created=await api('POST','/api/secretariats',payload,ownerA);
   assert.equal(created.status,201);deptA=created.body.id;
   assert.ok(deptA);
   assert.equal((await api('POST','/api/secretariats',payload,ownerA)).status,409);
   const other=await api('POST','/api/secretariats',{name:'Secretaria externa '+tag},ownerB);
   assert.equal(other.status,201);deptB=other.body.id;
   const autoMember=await admin.query(
    'SELECT user_id FROM municipal_secretariat_members WHERE secretariat_id=$1',[deptA]);
   assert.deepEqual(autoMember.rows.map(x=>x.user_id),[ownerA.id]);
   const ownPage=await page('/administracao/secretarias',ownerA);
   assert.equal(ownPage.status,200);
   assert.ok(ownPage.html.includes(payload.name));
   assert.ok(!ownPage.html.includes('Secretaria externa '+tag));
   const denied=await page('/administracao/secretarias',analyst);
   assert.equal(denied.status,200);
   assert.ok(!denied.html.includes(payload.name));
   assert.equal((await page('/administracao/secretarias')).status,307);
  });

  await t.test('autorização de integrantes exige conta ativa no mesmo município',async()=>{
   const p={secretariatId:deptA,userId:analyst.id};
   assert.equal((await api('POST','/api/secretariats/members',p)).status,401);
   assert.equal((await api('POST','/api/secretariats/members',p,analyst)).status,403);
   assert.equal((await api('POST','/api/secretariats/members',p,ownerB)).status,404);
   assert.equal((await api('POST','/api/secretariats/members',{...p,userId:ownerB.id},ownerA)).status,404);
   assert.equal((await api('POST','/api/secretariats/members',{...p,role:'admin'},ownerA)).status,400);
   assert.equal((await api('POST','/api/secretariats/members',p,ownerA,'https://intruso.invalid')).status,403);
   const granted=await api('POST','/api/secretariats/members',p,ownerA);
   assert.equal(granted.status,200);assert.equal(granted.body.changed,true);
   const same=await api('POST','/api/secretariats/members',p,ownerA);
   assert.equal(same.status,200);assert.equal(same.body.changed,false);
   assert.equal((await api('POST','/api/secretariats/members',
    {secretariatId:deptA,userId:outsider.id},ownerA)).status,200);
   const revoked=await api('PATCH','/api/secretariats/members',
    {secretariatId:deptA,userId:outsider.id},ownerA);
   assert.equal(revoked.status,200);assert.equal(revoked.body.changed,true);
   const repeated=await api('PATCH','/api/secretariats/members',
    {secretariatId:deptA,userId:outsider.id},ownerA);
   assert.equal(repeated.status,404);
   const reactivated=await api('POST','/api/secretariats/members',
    {secretariatId:deptA,userId:outsider.id},ownerA);
   assert.equal(reactivated.status,200);assert.equal(reactivated.body.changed,true);
  });

  await t.test('distribuição exige responsável autorizado e prazo real',async()=>{
   const data={projectId:projectA,secretariatId:deptA,assignedTo:analyst.id,
    title:'Preparar documentação '+tag,details:'Revisar certidões e reunir os comprovantes.',dueOn:due};
   assert.equal((await api('POST',path,data)).status,401);
   assert.equal((await api('POST',path,data,analyst)).status,403);
   assert.equal((await api('POST',path,{...data,municipalityId:tenantB},ownerA)).status,400);
   assert.equal((await api('POST',path,{...data,dueOn:'2026-02-30'},ownerA)).status,400);
   assert.equal((await api('POST',path,{...data,dueOn:'2101-01-01'},ownerA)).status,400);
   assert.equal((await api('POST',path,data,ownerA,'https://atacante.invalid')).status,403);
   assert.equal((await api('POST',path,{...data,assignedTo:ownerB.id},ownerA)).status,404);
   assert.equal((await api('POST',path,{...data,secretariatId:deptB},ownerA)).status,404);
   assert.equal((await api('POST',path,{...data,projectId:projectB},ownerA)).status,404);
   const created=await api('POST',path,data,ownerA);
   assert.equal(created.status,201);taskA=created.body.id;
   assert.equal(created.body.revision,1);
   const foreign=await api('POST',path,{...data,projectId:projectB,secretariatId:deptB,
    assignedTo:ownerB.id,title:'Tarefa privada prefeitura B '+tag},ownerB);
   assert.equal(foreign.status,201);taskB=foreign.body.id;
   const projectPage=await page('/projetos/'+projectA+'/tarefas',analyst);
   assert.equal(projectPage.status,200);assert.ok(projectPage.html.includes(data.title));
   assert.ok(projectPage.html.includes('Servidor analista-a'));
   assert.ok(!projectPage.html.includes('Tarefa privada prefeitura B'));
   assert.equal((await page('/projetos/'+projectA+'/tarefas',ownerB)).status,404);
   assert.equal((await page('/projetos/'+projectA+'/tarefas')).status,307);
   const dashboard=await page('/tarefas',analyst);
   assert.equal(dashboard.status,200);assert.ok(dashboard.html.includes(data.title));
   assert.ok(!dashboard.html.includes('Tarefa privada prefeitura B'));
   const bDashboard=await page('/tarefas?escopo=todas',ownerB);
   assert.equal(bDashboard.status,200);
   assert.ok(bDashboard.html.includes('Tarefa privada prefeitura B'));
   assert.ok(!bDashboard.html.includes(data.title));
  });

  await t.test('responsável altera situação com justificativa e versão, terceiros não',async()=>{
   const data={action:'status',taskId:taskA,expectedRevision:1,
    status:'em_andamento',note:'Equipe iniciou a organização dos documentos da candidatura.'};
   assert.equal((await api('PATCH',change,data)).status,401);
   assert.equal((await api('PATCH',change,data,outsider)).status,404);
   assert.equal((await api('PATCH',change,data,ownerB)).status,404);
   assert.equal((await api('PATCH',change,{...data,taskId:taskB},analyst)).status,404);
   assert.equal((await api('PATCH',change,{...data,role:'admin'},analyst)).status,400);
   assert.equal((await api('PATCH',change,{...data,note:'curta'},analyst)).status,400);
   const ok=await api('PATCH',change,data,analyst);
   assert.equal(ok.status,200);assert.equal(ok.body.changed,true);assert.equal(ok.body.revision,2);
   assert.equal((await api('PATCH',change,data,analyst)).status,409);
   const noop=await api('PATCH',change,{...data,expectedRevision:2},analyst);
   assert.equal(noop.status,200);assert.equal(noop.body.changed,false);
   assert.equal(noop.body.revision,2);
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM municipal_task_events WHERE task_id=$1',
    [taskA])).rows[0].n,2);
  });

  await t.test('transferência e mudança de prazo exigem administrador e preservam trilha',async()=>{
   const transfer={action:'transfer',taskId:taskA,expectedRevision:2,
    assignedTo:ownerA.id,note:'Transferência solicitada pela secretaria após revisão interna.'};
   assert.equal((await api('PATCH',change,transfer,analyst)).status,403);
   assert.equal((await api('PATCH',change,{...transfer,assignedTo:ownerB.id},ownerA)).status,404);
   assert.equal((await api('PATCH',change,transfer,ownerA)).status,200);
   assert.equal((await api('PATCH',change,{action:'status',taskId:taskA,
    expectedRevision:3,status:'concluida',note:'Tentativa de conclusão pelo antigo responsável.'},analyst)).status,404);
   const deadline={action:'deadline',taskId:taskA,expectedRevision:3,
    dueOn:changedDue,note:'Novo prazo aprovado para preparação do documento.'};
   assert.equal((await api('PATCH',change,deadline,outsider)).status,403);
   assert.equal((await api('PATCH',change,{...deadline,dueOn:'2026-11-31'},ownerA)).status,400);
   const ok=await api('PATCH',change,deadline,ownerA);
   assert.equal(ok.status,200);assert.equal(ok.body.revision,4);
   const stale=await api('PATCH',change,{...deadline,expectedRevision:3},ownerA);
   assert.equal(stale.status,409);
   const read=await admin.query('SELECT assigned_to,due_on,revision FROM municipal_tasks WHERE id=$1',
    [taskA]);
   assert.equal(read.rows[0].assigned_to,ownerA.id);
   assert.equal(read.rows[0].due_on.toISOString().slice(0,10),changedDue);
   assert.equal(read.rows[0].revision,4);
   const history=await admin.query(
    'SELECT event_type,revision,previous_assignee,next_assignee FROM municipal_task_events '+
    'WHERE task_id=$1 ORDER BY revision',[taskA]);
   assert.deepEqual(history.rows.map(x=>x.event_type),
    ['created','status_changed','transferred','deadline_changed']);
   assert.deepEqual(history.rows.map(x=>x.revision),[1,2,3,4]);
   assert.equal(history.rows[2].previous_assignee,analyst.id);
   assert.equal(history.rows[2].next_assignee,ownerA.id);
   const html=(await page('/projetos/'+projectA+'/tarefas',ownerA)).html;
   assert.ok(html.includes('Responsável transferido'));
   assert.ok(html.includes('Novo prazo aprovado'));
  });

  await t.test('revogar integrante com tarefa aberta não interrompe responsabilidade',async()=>{
   const revoked=await api('PATCH','/api/secretariats/members',
    {secretariatId:deptA,userId:ownerA.id},ownerA);
   assert.equal(revoked.status,409);
   const status={action:'status',taskId:taskA,expectedRevision:4,status:'concluida',
    note:'Atividade documental concluída e validada internamente pela equipe.'};
   const result=await api('PATCH',change,status,ownerA);
   assert.equal(result.status,200);assert.equal(result.body.revision,5);
   const revokeDone=await api('PATCH','/api/secretariats/members',
    {secretariatId:deptA,userId:ownerA.id},ownerA);
   assert.equal(revokeDone.status,200);assert.equal(revokeDone.body.changed,true);
   const history=await admin.query(
    "SELECT action FROM municipal_secretariat_member_events WHERE secretariat_id=$1 AND user_id=$2 ORDER BY recorded_at",
    [deptA,ownerA.id]);
   assert.deepEqual(history.rows.map(x=>x.action),['granted','revoked']);
  });

  await t.test('concorrência e conta desvinculada não criam tarefa aberta sem responsável',async()=>{
   const reopen={action:'status',taskId:taskA,expectedRevision:5,
    status:'pendente',note:'Tentativa de reabrir atividade após revogação de vínculo.'};
   assert.equal((await api('PATCH',change,reopen,ownerA)).status,404);
   const move=await api('PATCH',change,{action:'transfer',taskId:taskA,expectedRevision:5,
    assignedTo:outsider.id,note:'Tarefa concluída transferida para novo responsável ativo.'},ownerA);
   assert.equal(move.status,200);assert.equal(move.body.revision,6);
   const candidates=[
    {action:'status',taskId:taskA,expectedRevision:6,status:'pendente',
     note:'Retomar atividade documental depois da transferência.'},
    {action:'status',taskId:taskA,expectedRevision:6,status:'em_andamento',
     note:'Reabrir revisão de documentos depois da transferência.'},
   ];
   const outcomes=await Promise.all(candidates.map(data=>api('PATCH',change,data,ownerA)));
   assert.deepEqual(outcomes.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
   const [current]= (await admin.query('SELECT revision,assigned_to FROM municipal_tasks WHERE id=$1',
    [taskA])).rows;
   assert.equal(current.revision,7);
   assert.equal(current.assigned_to,outsider.id);
   assert.equal((await admin.query('SELECT count(*)::int AS n FROM municipal_task_events WHERE task_id=$1',
    [taskA])).rows[0].n,7);
   assert.equal((await api('PATCH','/api/secretariats/members',
    {secretariatId:deptA,userId:outsider.id},ownerA)).status,409);
   const closed=await api('PATCH',change,{action:'status',taskId:taskA,
    expectedRevision:7,status:'concluida',
    note:'Fechamento após conferência final do novo responsável.'},outsider);
   assert.equal(closed.status,200);assert.equal(closed.body.revision,8);
   const released=await api('PATCH','/api/secretariats/members',
    {secretariatId:deptA,userId:outsider.id},ownerA);
   assert.equal(released.status,200);assert.equal(released.body.changed,true);
  });

  await t.test('RLS bloqueia leitura sem contexto e tentativa de escritura cruzada',async()=>{
   assert.equal((await restricted.query('SELECT * FROM municipal_tasks')).rowCount,0);
   assert.equal((await restricted.query('SELECT * FROM municipal_task_events')).rowCount,0);
   await restricted.query('BEGIN');
   try{
    await restricted.query("SELECT set_config('app.tenant_id',$1,true)",[tenantA]);
    await restricted.query("SELECT set_config('app.actor_id',$1,true)",[analyst.id]);
    const visible=await restricted.query('SELECT id FROM municipal_tasks');
    assert.deepEqual(visible.rows.map(x=>x.id),[taskA]);
    const events=await restricted.query('SELECT task_id FROM municipal_task_events');
    assert.ok(events.rowCount>=5);
    assert.ok(events.rows.every(x=>x.task_id===taskA));
    await restricted.query('SAVEPOINT foreign_access');
    await assert.rejects(restricted.query(
     'INSERT INTO municipal_secretariats(municipality_id,name,created_by) VALUES($1,$2,$3)',
     [tenantB,'Secretaria indevida '+tag,ownerB.id]),/row-level security/i);
    await restricted.query('ROLLBACK TO SAVEPOINT foreign_access');
    await restricted.query('SAVEPOINT immutable_event');
    await assert.rejects(restricted.query(
      "UPDATE municipal_task_events SET note='Reescrever histórico' WHERE task_id=$1",
      [taskA]),/permission denied/i);
    await restricted.query('ROLLBACK TO SAVEPOINT immutable_event');
   }finally{await restricted.query('ROLLBACK');}
   assert.equal((await restricted.query('SELECT * FROM municipal_tasks')).rowCount,0);
  });
 }finally{
  try{
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   // Tasks and task-events are removed by the project CASCADE.
   if(cities.length){
    await admin.query('DELETE FROM municipal_secretariat_member_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM municipal_secretariat_members WHERE municipality_id=ANY($1::uuid[])',[cities]);
    await admin.query('DELETE FROM municipal_secretariats WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(cities.length)await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await restricted.end();await admin.end();}
 }
});
