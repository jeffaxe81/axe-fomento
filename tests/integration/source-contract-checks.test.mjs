import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||!process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw Error('Contract checks require isolated CI PostgreSQL and web server');
test('V1: contract check is disabled by default, admin-only and tenant-isolated',async t=>{
 const db=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await db.connect();await app.connect();
 const tag=randomUUID().slice(0,8);
 const ids={cities:[],users:[]};
 const secret='CI-ONLY-'+tag+'-password',hash=await bcrypt.hash(secret,10),base=process.env.TEST_BASE_URL;
 async function actor(code,role){
  const name='Municipio contrato '+tag+' '+code;
  const city=(await db.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",[name])).rows[0].id;
  ids.cities.push(city);
  const email='contract-'+tag+'-'+code+'@example.invalid';
  const person=(await db.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id',
   [city,'Gestor '+code,email,hash,role])).rows[0].id;
  ids.users.push(person);
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password:secret})});
  assert.equal(login.status,200);
  return {city,person,cookie:login.headers.get('set-cookie')?.split(';')[0]};
 }
 const headers=a=>({'content-type':'application/json',origin:base,...(a?.cookie?{cookie:a.cookie}:{})});
 const post=async(a,body)=>fetch(base+'/api/sources/contracts',{method:'POST',headers:headers(a),body:JSON.stringify(body)});
 const get=async(a)=>fetch(base+'/api/sources/contracts',{headers:headers(a)});
 try{
  const alpha=await actor('A','admin'),beta=await actor('B','admin');
  const analyst=await actor('C','analyst');
  await t.test('requires admin and never fetches official API when feature flag is off',async()=>{
   assert.equal((await post(null,{source:'parcerias'})).status,401);
   assert.equal((await post(analyst,{source:'parcerias'})).status,403);
   assert.equal((await post(alpha,{source:'parcerias'})).status,503);
   assert.equal((await post(alpha,{source:'discricionarias',url:'https://evil.invalid'})).status,503);
   assert.equal((await get(analyst)).status,403);
   assert.equal((await get(null)).status,401);
  });
  await t.test('check snapshots are append only and invisible to other municipalities',async()=>{
   const check=(await db.query('INSERT INTO source_contract_checks(municipality_id,source,schema_url,'+
    'result,schema_digest,openapi_version,route_count,candidate_routes,message,created_by) '+
    "VALUES($1,'parcerias','https://api-publica.transferegov.gestao.gov.br/parcerias/openapi.json',"+
    "'documented',repeat('a',64),'3.1.0',1,'[\"/programa\"]'::jsonb,"+
    "'Validação sintética do contrato no banco descartável',$2) RETURNING id",
    [alpha.city,alpha.person])).rows[0].id;
   const own=await get(alpha),other=await get(beta);
   assert.equal(own.status,200);assert.equal(other.status,200);
   assert.ok((await own.text()).includes(check));
   assert.ok(!(await other.text()).includes(check));
   assert.equal((await app.query('SELECT id FROM source_contract_checks')).rowCount,0);
   await assert.rejects(app.query('DELETE FROM source_contract_checks WHERE id=$1',[check]),/permission denied/i);
  });
 }finally{
  try{if(ids.cities.length)await db.query('DELETE FROM source_contract_checks WHERE municipality_id=ANY($1::uuid[])',[ids.cities]);
   if(ids.users.length)await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids.users]);
   if(ids.cities.length)await db.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[ids.cities]);
  }finally{await app.end();await db.end();}
 }
});
