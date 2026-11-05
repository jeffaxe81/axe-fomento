import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {STAGE_PROGRAM_SQL} from '../../lib/source-stage-sql.mjs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes' || !process.env.DATABASE_ADMIN_URL ||
  !process.env.DATABASE_URL || !process.env.TEST_BASE_URL)
  throw new Error('Exige banco de teste descartável e servidor.');
const sourceUrl='https://api-publica.transferegov.gestao.gov.br/parcerias/programa';
test('Fontes oficiais: curadoria, versões, RLS, permissões e falha fechada',async(t)=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const cityIds=[],users=[],recordIds=[];
 const suffix=randomUUID().slice(0,8);
 const base=process.env.TEST_BASE_URL;
 const password='Somente-Teste-Fontes-2026!';
 const hash=await bcrypt.hash(password,10);
 async function createCity(label){
   const rows=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",['Fonte-'+suffix+label]);
   cityIds.push(rows.rows[0].id);return rows.rows[0].id;
 }
 async function actor(municipalityId,label,role){
   const email='fonte-'+suffix+label+'@example.invalid';
   const r=await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
     'VALUES($1,$2,$3,$4,$5) RETURNING id',[municipalityId,'Curador '+label,email,hash,role]);
   users.push(r.rows[0].id);
   const auth=await fetch(base+'/api/auth/login',{method:'POST',
     headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
   assert.equal(auth.status,200);
   return {id:r.rows[0].id,municipalityId,cookie:auth.headers.get('set-cookie')?.split(';')[0]};
 }
 async function page(path,as){
   const res=await fetch(base+path,{redirect:'manual',
      headers:as?.cookie?{cookie:as.cookie}:{}});
   return {status:res.status,html:await res.text(),location:res.headers.get('location')};
 }
 async function post(path,data,as,origin=base){
   const res=await fetch(base+path,{method:'POST',headers:{
     'content-type':'application/json',origin,...(as?.cookie?{cookie:as.cookie}:{})
   },body:JSON.stringify(data)});
   return {status:res.status,json:await res.json()};
 }
 try{
   const a=await createCity('A'),b=await createCity('B');
   const adminA=await actor(a,'adminA','admin');
   const adminB=await actor(b,'adminB','admin');
   const analystA=await actor(a,'analystA','analyst');
   const record=await admin.query(
     'INSERT INTO source_programs(municipality_id,external_id,title,provider,source_url,checksum,version) '+
     'VALUES($1,$2,$3,$4,$5,$6,2) RETURNING id',
     [a,'123-TESTE','Programa educação versão 2','Órgão público fictício',sourceUrl,'b'.repeat(64)]);
   const id=record.rows[0].id;recordIds.push(id);
   for (const [version, title, hash] of [[1,'Programa educação versão 1','a'.repeat(64)],
                                         [2,'Programa educação versão 2','b'.repeat(64)]]) {
     await admin.query('INSERT INTO source_program_versions(program_id,municipality_id,version,checksum,snapshot) '+
       'VALUES($1,$2,$3,$4,$5)',[id,a,version,hash,{
        external_id:'123-TESTE',title,provider:'Órgão público fictício',source_url:sourceUrl,
       }]);
   }
   const other=await admin.query(
     'INSERT INTO source_programs(municipality_id,external_id,title,provider,source_url,checksum) '+
     'VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
     [b,'456-TESTE','Programa exclusivo B','Outra instituição',sourceUrl,'c'.repeat(64)]);
   recordIds.push(other.rows[0].id);
   await admin.query('INSERT INTO source_program_versions(program_id,municipality_id,version,checksum,snapshot) '+
       'VALUES($1,$2,1,$3,$4)',[other.rows[0].id,b,'c'.repeat(64),
        {external_id:'456-TESTE',title:'Programa exclusivo B',provider:'Outra instituição',source_url:sourceUrl}]);

   await t.test('tela e histórico só expõem dados do município e do administrador',async()=>{
      const own=await page('/fontes',adminA);
      assert.equal(own.status,200);
      assert.ok(own.html.includes('Programa educação versão 2'));
      assert.ok(!own.html.includes('Programa exclusivo B'));
      const details=await page('/fontes/'+id,adminA);
      assert.equal(details.status,200);
      assert.ok(details.html.includes('Programa educação versão 1'));
      assert.ok(details.html.includes('Programa educação versão 2'));
      assert.ok(details.html.includes('Não informado / não verificado'));
      const foreign=await page('/fontes/'+id,adminB);
      assert.equal(foreign.status,404);
      assert.ok(!foreign.html.includes('Programa educação'));
      const analyst=await page('/fontes',analystA);
      assert.equal(analyst.status,200);
      assert.ok(!analyst.html.includes('Programa educação versão 2'));
      assert.equal((await page('/fontes/'+id,analystA)).status,404);
      assert.equal((await page('/fontes')).status,307);
   });
   await t.test('revisão exige admin, versão atual, justificativa e origem legítima',async()=>{
      const payload={id,version:2,decision:'approved',justification:'Confirmei título e órgão na fonte oficial.'};
      const route='/api/sources/transferegov/review';
      assert.equal((await post(route,payload,undefined)).status,401);
      assert.equal((await post(route,payload,analystA)).status,403);
      assert.equal((await post(route,payload,adminB)).status,409);
      assert.equal((await post(route,{...payload,version:1},adminA)).status,409);
      assert.equal((await post(route,{...payload,justification:'curta'},adminA)).status,400);
      assert.equal((await post(route,{...payload,municipalityId:b},adminA)).status,400);
      assert.equal((await post(route,payload,adminA,'https://site-invasor.invalid')).status,403);
      assert.equal((await post(route,payload,adminA)).status,200);
      const state=await admin.query('SELECT review_state,reviewer_id FROM source_programs WHERE id=$1',[id]);
      assert.equal(state.rows[0].review_state,'approved');
      assert.equal(state.rows[0].reviewer_id,adminA.id);
      const audit=await admin.query('SELECT decision,justification FROM source_program_reviews WHERE program_id=$1',[id]);
      assert.equal(audit.rowCount,1);
      assert.equal(audit.rows[0].decision,'approved');
      assert.ok((await page('/fontes/'+id,adminA)).html.includes('Confirmei título'));
   });
   await t.test('coleta permanece fechada sem liberação explícita do operador',async()=>{
      assert.equal((await post('/api/sources/transferegov/run',{},undefined)).status,401);
      assert.equal((await post('/api/sources/transferegov/run',{},analystA)).status,403);
      assert.equal((await post('/api/sources/transferegov/run',{},adminA)).status,503);
   });
   await t.test('staging mantém idempotência, versões e reinicia revisão após mudança',async()=>{
      const ext='STAGING-'+suffix;
      const provider='Secretaria de teste';
      const sourceKey='transferegov-parcerias-programa';
      async function stage(title){
        const hash=createHash('sha256').update(JSON.stringify([ext,title,provider,sourceUrl])).digest('hex');
        await app.query('BEGIN');
        try{
          await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
          await app.query("SELECT set_config('app.actor_id',$1,true)",[adminA.id]);
          const result=await app.query(STAGE_PROGRAM_SQL,
            [a,adminA.id,sourceKey,ext,title,provider,sourceUrl,hash]);
          await app.query('COMMIT');
          return result.rows[0];
        }catch(error){await app.query('ROLLBACK');throw error;}
      }
      const first=await stage('Título inicial');
      assert.equal(first.version,1);
      assert.equal(first.new_version,true);
      const {rows:[item]}=await admin.query(
        'SELECT id,review_state FROM source_programs WHERE municipality_id=$1 AND external_id=$2',[a,ext]);
      recordIds.push(item.id);
      assert.equal(item.review_state,'pending');
      const decision=await post('/api/sources/transferegov/review',
        {id:item.id,version:1,decision:'approved',justification:'Registro revisado antes da nova coleta.'},adminA);
      assert.equal(decision.status,200);
      const same=await stage('Título inicial');
      assert.equal(same.version,1);
      assert.equal(same.new_version,false);
      assert.equal((await admin.query('SELECT review_state FROM source_programs WHERE id=$1',[item.id]))
        .rows[0].review_state,'approved');
      const changed=await stage('Título atualizado');
      assert.equal(changed.version,2);
      assert.equal(changed.new_version,true);
      const state=(await admin.query('SELECT version,review_state FROM source_programs WHERE id=$1',[item.id]))
        .rows[0];
      assert.equal(state.version,2);
      assert.equal(state.review_state,'pending');
      const history=await admin.query(
        'SELECT version FROM source_program_versions WHERE program_id=$1 ORDER BY version',[item.id]);
      assert.deepEqual(history.rows.map(x=>x.version),[1,2]);
      assert.equal((await post('/api/sources/transferegov/review',
        {id:item.id,version:1,decision:'approved',justification:'Não aceitar versão antiga.'},adminA)).status,409);
   });
   await t.test('PostgreSQL aplica RLS inclusive com SELECT sem filtro e tentativas cruzadas',async()=>{
      assert.equal((await app.query('SELECT * FROM source_programs')).rowCount,0);
      assert.equal((await app.query('SELECT * FROM source_program_versions')).rowCount,0);
      assert.equal((await app.query('SELECT * FROM source_program_reviews')).rowCount,0);
      await app.query('BEGIN');
      try{
        await app.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
        assert.equal((await app.query('SELECT id FROM source_programs')).rowCount,2);
        assert.equal((await app.query('SELECT version FROM source_program_versions')).rowCount,4);
        await app.query('SAVEPOINT cross_insert');
        await assert.rejects(app.query(
          'INSERT INTO source_programs(municipality_id,external_id,title,provider,source_url,checksum) '+
          "VALUES($1,'forjado','Tentativa','Instituição',$2,$3)",
          [b,sourceUrl,'d'.repeat(64)]),/row-level security/i);
        await app.query('ROLLBACK TO SAVEPOINT cross_insert');
      }finally{await app.query('ROLLBACK');}
      assert.equal((await app.query('SELECT id FROM source_programs')).rowCount,0);
      await app.query('BEGIN');
      try{
        await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
        assert.deepEqual((await app.query('SELECT title FROM source_programs')).rows.map(v=>v.title),
         ['Programa exclusivo B']);
      }finally{await app.query('ROLLBACK');}
   });
 }finally{
   try{await app.query('ROLLBACK');}catch{}
   try{
     if(recordIds.length) {
       await admin.query('DELETE FROM source_program_reviews WHERE program_id=ANY($1::uuid[])',[recordIds]);
       await admin.query('DELETE FROM source_program_versions WHERE program_id=ANY($1::uuid[])',[recordIds]);
       await admin.query('DELETE FROM source_programs WHERE id=ANY($1::uuid[])',[recordIds]);
     }
     if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
     if(cityIds.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cityIds]);
   }finally{await app.end();await admin.end();}
 }
});
