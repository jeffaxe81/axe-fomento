import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
   !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)throw new Error('Banco de testes descartável requerido');
test('AF-015/016: convites e ciclo de vida isolados por prefeitura',async(t)=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const restricted=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await restricted.connect();
 const base=process.env.TEST_BASE_URL,suffix=randomUUID().slice(0,8);
 const cities=[],actors=[],password='Senha-Fomento-Somente-Teste-2026!';
 const hash=await bcrypt.hash(password,10);
 async function createActor(city,label,role){
   const email='govern-'+suffix+'-'+label+'@example.invalid';
   const result=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id',
     [city,'Teste '+label,email,hash,role]);
   const id=result.rows[0].id;actors.push(id);
   const login=await signIn(email,password);
   assert.equal(login.status,200);
   return {id,email,cookie:login.cookie};
 }
 async function signIn(email,secret){
   const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:secret})});
   return {status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function request(method,path,data,who,origin=base){
   const response=await fetch(base+path,{method,redirect:'manual',
     headers:{'content-type':'application/json',origin,...(who?.cookie?{cookie:who.cookie}:{})},
     body:JSON.stringify(data)});
   return {status:response.status,json:await response.json()};
 }
 async function page(path,who){
   const response=await fetch(base+path,{redirect:'manual',headers:who?.cookie?{cookie:who.cookie}:{}});return {status:response.status,html:await response.text()};
 }
 try{
   for(const name of ['A','B']){
     const result=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
       ['Governo-'+suffix+name]);cities.push(result.rows[0].id);
   }
   const adminA=await createActor(cities[0],'admin-a','admin');
   const analyst=await createActor(cities[0],'analyst-a','analyst');
   const adminB=await createActor(cities[1],'admin-b','admin');
   const invitee='new-'+suffix+'@example.invalid';
   const invitePath='/api/admin/invitations',acceptPath='/api/auth/invite/accept';
   let currentCode,newUserId,oldCookie;

   await t.test('autorização, isolamento e código que nunca aparece no histórico',async()=>{
     const data={email:invitee,role:'analyst'};
     assert.equal((await request('POST',invitePath,data)).status,401);
     assert.equal((await request('POST',invitePath,data,analyst)).status,403);
     assert.equal((await request('POST',invitePath,{...data,municipalityId:cities[1]},adminA)).status,400);
     assert.equal((await request('POST',invitePath,{...data,role:'owner'},adminA)).status,400);
     assert.equal((await request('POST',invitePath,data,adminA,'https://intruso.invalid')).status,403);
     assert.equal((await request('POST',invitePath,{email:analyst.email,role:'analyst'},adminA)).status,409);
     const first=await request('POST',invitePath,data,adminA);
     assert.equal(first.status,201);
     assert.match(first.json.code,/^[A-Za-z0-9_-]{43}$/);
     currentCode=first.json.code;
     const saved=(await admin.query('SELECT email,role,token_hash,municipality_id,expires_at FROM user_invitations WHERE email=$1',[invitee])).rows[0];
     assert.equal(saved.municipality_id,cities[0]);
     assert.equal(saved.role,'analyst');
     assert.equal(saved.token_hash,createHash('sha256').update(currentCode).digest('hex'));
     assert.ok(Date.parse(saved.expires_at)-Date.now()>46*3600*1000);
     const own=await page('/administracao/usuarios',adminA);
     assert.equal(own.status,200);
     assert.ok(own.html.includes(invitee));
     assert.ok(!own.html.includes(currentCode));
     assert.ok(!(await page('/administracao/usuarios',adminB)).html.includes(invitee));
     assert.ok(!(await page('/administracao/usuarios',analyst)).html.includes(invitee));
     assert.equal((await page('/administracao/usuarios')).status,307);
   });

   await t.test('reemissão revoga o código anterior, aceitação concorrente cria uma conta',async()=>{
     const repeated=await request('POST',invitePath,{email:invitee,role:'analyst'},adminA);
     assert.equal(repeated.status,201);
     const payload={code:currentCode,fullName:'Pessoa Convidada',password:'Senha-Convidada-2026!'};
     assert.equal((await request('POST',acceptPath,payload)).status,400);
     currentCode=repeated.json.code;
     assert.equal((await request('POST',acceptPath,{...payload,code:currentCode,password:'fraca'})).status,400);
     assert.equal((await request('POST',acceptPath,{...payload,code:currentCode,municipalityId:cities[1]})).status,400);
     const outcomes=await Promise.all([
       request('POST',acceptPath,{...payload,code:currentCode}),
       request('POST',acceptPath,{...payload,code:currentCode})
     ]);
     assert.deepEqual(outcomes.map(x=>x.status).sort(),[201,400]);
     assert.equal((await request('POST',acceptPath,{...payload,code:currentCode})).status,400);
     const result=await admin.query('SELECT id,municipality_id,role,active FROM users WHERE email=$1',[invitee]);
     assert.equal(result.rowCount,1);
     newUserId=result.rows[0].id;actors.push(newUserId);
     assert.equal(result.rows[0].municipality_id,cities[0]);
     assert.equal(result.rows[0].role,'analyst');
     assert.equal(result.rows[0].active,true);
     const accepted=await signIn(invitee,'Senha-Convidada-2026!');
     assert.equal(accepted.status,200);oldCookie=accepted.cookie;
     assert.equal((await page('/projetos',{cookie:oldCookie})).status,200);
   });

   await t.test('expiração impede cadastro',async()=>{
     const addr='expired-'+suffix+'@example.invalid';
     const invite=await request('POST',invitePath,{email:addr,role:'analyst'},adminA);
     assert.equal(invite.status,201);
     await admin.query("UPDATE user_invitations SET issued_at=clock_timestamp()-interval '3 days', expires_at=clock_timestamp()-interval '1 day' WHERE email=$1",[addr]);
     assert.equal((await request('POST',acceptPath,{
       code:invite.json.code,fullName:'Outra Pessoa',password:'Senha-Convidada-2026!'})).status,400);
     assert.equal((await admin.query('SELECT id FROM users WHERE email=$1',[addr])).rowCount,0);
   });

   await t.test('desativação revoga sessão e reativação exige novo login',async()=>{
     const api='/api/admin/users/status',payload={userId:newUserId,active:false};
     assert.equal((await request('PATCH',api,payload)).status,401);
     assert.equal((await request('PATCH',api,payload,analyst)).status,403);
     assert.equal((await request('PATCH',api,payload,adminB)).status,404);
     assert.equal((await request('PATCH',api,{...payload,municipalityId:cities[1]},adminA)).status,400);
     assert.equal((await request('PATCH',api,payload,adminA,'https://intruso.invalid')).status,403);
     assert.equal((await request('PATCH',api,{userId:adminA.id,active:false},adminA)).status,409);
     assert.equal((await request('PATCH',api,{userId:adminB.id,active:false},adminB)).status,409);
     assert.equal((await request('PATCH',api,payload,adminA)).status,200);
     assert.equal((await page('/projetos',{cookie:oldCookie})).status,307);
     assert.equal((await signIn(invitee,'Senha-Convidada-2026!')).status,401);
     const sessions=await admin.query('SELECT revoked_at FROM user_sessions WHERE user_id=$1',[newUserId]);
     assert.ok(sessions.rowCount>0 && sessions.rows.every(x=>x.revoked_at));
     const same=await request('PATCH',api,payload,adminA);
     assert.equal(same.status,200);assert.equal(same.json.unchanged,true);
     assert.equal((await request('PATCH',api,{userId:newUserId,active:true},adminA)).status,200);
     assert.equal((await page('/projetos',{cookie:oldCookie})).status,307);
     assert.equal((await signIn(invitee,'Senha-Convidada-2026!')).status,200);
     const audit=await admin.query('SELECT action FROM audit_events WHERE record_id=$1 AND action LIKE $2 ORDER BY action',
       [newUserId,'security.account_%']);
     assert.deepEqual(audit.rows.map(x=>x.action),['security.account_deactivated','security.account_reactivated']);
   });

   await t.test('SQL privilegia sessão verificada e nega tabela sensível',async()=>{
     const r=await restricted.query('SELECT public.auth_admin_set_account_state($1,$2,$3,$4) AS result',
       [adminA.id,randomUUID(),newUserId,false]);
     assert.equal(r.rows[0].result,'unauthorized');
     await assert.rejects(restricted.query('SELECT * FROM user_invitations'),/permission denied/i);
     await assert.rejects(restricted.query('UPDATE users SET active=false WHERE id=$1',[newUserId]),/permission denied/i);
   });
 }finally{
   try{
     if(cities.length){
       await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
       await admin.query('DELETE FROM user_invitations WHERE municipality_id=ANY($1::uuid[])',[cities]);
     }
     if(actors.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[actors]);
     if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
   }finally{await restricted.end();await admin.end();}
 }
});
