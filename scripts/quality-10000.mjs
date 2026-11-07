#!/usr/bin/env node
// AXE Fomento — 10,000 unique, deterministic test vectors against real domain logic,
// database-generated columns, tenant RLS and running HTTP API. CI test database ONLY.
// No production endpoints, live portals, or customer data are accessed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {
  parseBRLToCents, formatBRLCents,
} from '../lib/financial-money.mjs';
import {
  parseQuantityMilli, formatQuantityMilli, budgetLineTotalCents, budgetInput,
} from '../lib/budget-math.mjs';
import { simulateCounterpart } from '../lib/counterpart-simulation.mjs';
import { validateDate, daysToExpiry } from '../lib/document-validity.mjs';

const SEED=0x20261106;
const TARGET=10000;
const expectedCategories={
 'dinheiro-valido':1600,
 'dinheiro-invalido':800,
 'quantidade-valida':1600,
 'quantidade-invalida':800,
 'arredondamento-orcamento':1600,
 'contrapartida':1600,
 'datas-validade':500,
 'postgres-calculos':500,
 'rls-municipal':500,
 'http-seguranca':500,
};
const counts=Object.fromEntries(Object.keys(expectedCategories).map(x=>[x,0]));
let state=SEED>>>0,passed=0;
function rnd(){
 state^=state<<13;state^=state>>>17;state^=state<<5;
 return state>>>0;
}
function verify(category,index,fn) {
 try{fn();counts[category]++;passed++;}
 catch(err){throw new Error('CASO '+(passed+1)+' ['+category+'#'+index+
  ', seed='+SEED.toString(16)+'] falhou: '+(err?.stack||err));}
}
const dec2=n=>String(n).padStart(2,'0');
const money=cents=>String(cents/100n)+','+dec2(Number(cents%100n));
const qtyText=millis=>{
 const whole=String(millis/1000n);
 const d=String(millis%1000n).padStart(3,'0').replace(/0+$/,'');
 return d?whole+','+d:whole;
};
const exactLine=(qty,cost)=>{
 const n=qty*cost,whole=n/1000n;
 return (whole+(n%1000n>=500n?1n:0n)).toString();
};
function validGregorian(y,m,d){
 const leap=y%4===0&&(y%100!==0||y%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
 return d>=1&&d<=days;
}
function baseCases(){
 for(let i=0;i<1600;i++){
  const whole=(BigInt(rnd())*50133n+BigInt(i))%1000000000000n;
  const fraction=rnd()%100;
  const sep=i%2?',':'.';
  const v=whole.toString()+sep+dec2(fraction);
  verify('dinheiro-valido',i,()=>{
   const expected=(whole*100n+BigInt(fraction)).toString();
   assert.equal(parseBRLToCents(v),expected);
   assert.equal(formatBRLCents(expected),'R$ '+whole.toLocaleString('pt-BR')+','+dec2(fraction));
  });
 }
 for(let i=0;i<800;i++){
  const n=(rnd()%900000+100000).toString();
  const values=[
   '-'+n+',00', '+'+n+',00', ' '+n+',00', n+',00 ',
   n+'.000', n+',000', n+',0,0', n+'e2', n+'..00',
   n+'x00', n+'.123,00', '1000000000000,00',
  ];
  verify('dinheiro-invalido',i,()=>{
   assert.equal(parseBRLToCents(values[i%values.length]),null);
  });
 }
 for(let i=0;i<1600;i++){
  const milli=(BigInt(rnd())*1237n+BigInt(i))%999999999n+1n;
  const text=qtyText(milli);
  verify('quantidade-valida',i,()=>{
   assert.equal(parseQuantityMilli(i%2?text:text.replace(',','.')),milli.toString());
   assert.equal(formatQuantityMilli(milli),text);
  });
 }
 for(let i=0;i<800;i++){
  const n=(rnd()%999998+1).toString();
  const values=[
   '-'+n, '+'+n, ' '+n, n+' ', n+',0000', n+'.0000',
   n+'e3', n+'.5,0', '1000000', '0', '0,000',
   '01,001', n+'..1', n+',1,2',
  ];
  verify('quantidade-invalida',i,()=>{
   assert.equal(parseQuantityMilli(values[i%values.length]),null);
  });
 }
 for(let i=0;i<1600;i++){
  const milli=i%8===0?500n:i%8===1?499n:
   BigInt((rnd()%999999999)+1);
  const cents=i%8<2?1n:BigInt(rnd()%1000000000);
  const exact=exactLine(milli,cents);
  verify('arredondamento-orcamento',i,()=>{
   assert.equal(budgetLineTotalCents(milli,cents),exact);
   const input=budgetInput(qtyText(milli),money(cents));
   assert.ok(input);
   assert.equal(input.quantityMilli,milli.toString());
   assert.equal(input.unitCostCents,cents.toString());
   assert.equal(input.totalCents,exact);
  });
 }
 for(let i=0;i<1600;i++){
  const total=BigInt(rnd())*BigInt(rnd())+BigInt(i);
  const basis=i%12===0?0:i%12===1?10000:rnd()%10001;
  const available=(BigInt(rnd())*43291n)%100000000000000n;
  const percent=Math.trunc(basis/100)+','+dec2(basis%100);
  const sim=simulateCounterpart(total.toString(),percent,money(available));
  const numerator=total*BigInt(basis);
  const contribution=numerator/10000n+(numerator%10000n>=5000n?1n:0n);
  const difference=available-contribution;
  verify('contrapartida',i,()=>{
   assert.ok(sim);
   assert.equal(sim.rateBasisPoints,basis);
   assert.equal(sim.totalCents,total.toString());
   assert.equal(sim.municipalCents,contribution.toString());
   assert.equal(sim.remainingProjectCents,(total-contribution).toString());
   assert.equal(sim.availableCents,available.toString());
   assert.equal(sim.shortageCents,difference<0n?(-difference).toString():'0');
   assert.equal(sim.surplusCents,difference>0n?difference.toString():'0');
  });
 }
 for(let i=0;i<500;i++){
  const year=2000+(rnd()%101),month=1+rnd()%12,day=1+rnd()%31;
  const ymd=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const valid=validGregorian(year,month,day);
  verify('datas-validade',i,()=>{
   assert.equal(validateDate(ymd),valid);
   if(valid){
    assert.equal(daysToExpiry(ymd,ymd),0);
   }else assert.equal(daysToExpiry(ymd,'2026-11-06'),null);
  });
 }
}

async function infrastructureCases(){
 if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||
  !process.env.DATABASE_ADMIN_URL||!process.env.DATABASE_URL||
  !process.env.TEST_BASE_URL)
  throw new Error('Bateria de 10.000 casos exige CI isolado (PostgreSQL + HTTP)');
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const tag=randomUUID().slice(0,12);
 const cities=[],userIds=[],projectIds=[];
 let stageId=null,owner,municipalityA,municipalityB,foreignProject;
 try {
  for(const suffix of ['A','B']){
   const res=await admin.query(
    "INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
    ['Quality10000 '+tag+' '+suffix]);
   cities.push(res.rows[0].id);
  }
  [municipalityA,municipalityB]=cities;
  const email='quality10000-'+tag+'@example.invalid';
  const password='Only-Test-Suite-Quality-2026!';
  const passwordHash=await bcrypt.hash(password,10);
  const user=await admin.query(
   'INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipalityA,'Teste orcamento isolado',email,passwordHash,'analyst']);
  owner=user.rows[0].id;userIds.push(owner);
  const project=await admin.query(
   'INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',
   [municipalityA,owner,'Projeto sintético '+tag]);
  const projectId=project.rows[0].id;projectIds.push(projectId);
  const foreign=await admin.query(
   'INSERT INTO projects(municipality_id,title) VALUES($1,$2) RETURNING id',
   [municipalityB,'Projeto sintético alheio '+tag]);
  foreignProject=foreign.rows[0].id;projectIds.push(foreignProject);
  const stage=await admin.query(
   'INSERT INTO project_budget_stages '+
   '(municipality_id,project_id,stage_number,title,starts_on,ends_on,assumptions,created_by) '+
   "VALUES($1,$2,1,$3,'2027-01-02','2027-05-30',$4,$5) RETURNING id",
   [municipalityA,projectId,'Etapa sintética teste '+tag,
    'Simulação exclusiva de banco descartável, sem valores reais.',owner]);
  stageId=stage.rows[0].id;
  const qty=[],cost=[],reference=new Map();
  for(let i=0;i<500;i++){
   const q=i%9===0?500n:BigInt(rnd()%999999999+1);
   const c=i%9===0?1n:BigInt(rnd()%80000000);
   qty.push(q.toString());cost.push(c.toString());
   reference.set(i+1,{quantity:q,cost:c,total:exactLine(q,c)});
  }
  await admin.query(
   'INSERT INTO project_budget_items '+
   '(municipality_id,project_id,stage_id,line_number,title,unit,quantity_milli,'+
   'unit_cost_cents,assumptions,created_by) '+
   "SELECT $1::uuid,$2::uuid,$3::uuid,x.ordinality::integer,"+
   "'Item sintético número '||x.ordinality::text,'un',x.quantity,x.unit_cost,"+
   "'Custo calculado em banco descartável, por vetor determinístico.', $4::uuid "+
   'FROM unnest($5::bigint[], $6::bigint[]) '+
   'WITH ORDINALITY AS x(quantity,unit_cost,ordinality)',
   [municipalityA,projectId,stageId,owner,qty,cost]);
  const result=await admin.query(
   'SELECT id,line_number,quantity_milli,unit_cost_cents,line_total_cents '+
   'FROM project_budget_items WHERE stage_id=$1 ORDER BY line_number',[stageId]);
  assert.equal(result.rows.length,500);
  let sum=0n;
  for(let i=0;i<500;i++){
   const row=result.rows[i],ref=reference.get(i+1);
   verify('postgres-calculos',i,()=>{
    assert.equal(row.line_number,i+1);
    assert.equal(row.quantity_milli,ref.quantity.toString());
    assert.equal(row.unit_cost_cents,ref.cost.toString());
    assert.equal(row.line_total_cents,ref.total);
   });
   sum+=BigInt(ref.total);
  }
  const actualSum=(await admin.query(
   'SELECT SUM(line_total_cents::numeric)::text AS value FROM project_budget_items '+
   'WHERE stage_id=$1',[stageId])).rows[0].value;
  assert.equal(actualSum,sum.toString(),'Total PostgreSQL divergente');

  await app.query('BEGIN');
  let ownRows;
  try{
   await app.query("SELECT set_config('app.tenant_id',$1,true)",[municipalityA]);
   await app.query("SELECT set_config('app.actor_id',$1,true)",[owner]);
   ownRows=(await app.query(
    'SELECT id,line_number FROM project_budget_items WHERE project_id=$1',[projectId])).rows;
  }finally{await app.query('ROLLBACK');}
  await app.query('BEGIN');
  let otherRows;
  try{
   await app.query("SELECT set_config('app.tenant_id',$1,true)",[municipalityB]);
   otherRows=(await app.query(
    'SELECT id,line_number FROM project_budget_items WHERE project_id=$1',[projectId])).rows;
  }finally{await app.query('ROLLBACK');}
  const ownIds=new Set(ownRows.map(row=>row.id));
  const foreignIds=new Set(otherRows.map(row=>row.id));
  for(let i=0;i<500;i++){
   const row=result.rows[i];
   verify('rls-municipal',i,()=>{
    assert.ok(ownIds.has(row.id),'Prefeitura titular não enxerga registro próprio');
    assert.ok(!foreignIds.has(row.id),'Vazamento entre municípios');
   });
  }

  const base=process.env.TEST_BASE_URL;
  const login=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({email,password})});
  assert.equal(login.status,200,'Autenticação de usuário de teste');
  const cookie=login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie,'Cookie de teste ausente');
  const stagePath=base+'/api/projects/budget/stages';
  const itemPath=base+'/api/projects/budget/items';
  const stageBody={
   projectId,stageNumber:99,title:'Teste de autenticacao por HTTP',
   startsOn:'2027-01-01',endsOn:'2027-12-31',
   assumptions:'Somente caso negativo de teste, não deve ser persistido.',
  };
  const itemBody={
   projectId,stageId,lineNumber:999,title:'Teste item inválido de HTTP',
   unit:'un',quantity:'1,001',unitCost:'100,00',
   assumptions:'Somente caso negativo de teste, não deve ser persistido.',
  };
  // A bounded pool exercises real endpoints; not a claim of 500 concurrent users.
  const concurrency=8;
  let nextIndex=0;
  async function worker(){
   while(nextIndex<500){
    const index=nextIndex++;
    const mode=index%5;
    const body=mode===3?{
     ...itemBody,quantity:(index+1)+',0001'
    }:mode===4?{
     ...stageBody,projectId:foreignProject,stageNumber:(index%100)+1,
    }:mode===2?{
     ...stageBody,stageNumber:(index%100)+1,startsOn:'2027-02-30'
    }:{...stageBody,stageNumber:(index%100)+1};
    const response=await fetch(mode===3?itemPath:stagePath,{
     method:'POST',headers:{
      'content-type':'application/json',
      origin:mode===0?'https://invalid.example.net':base,
      ...(mode!==1?{cookie}:{}),
     },body:JSON.stringify(body),
     signal:AbortSignal.timeout(15000),
    });
    const status=response.status;
    await response.arrayBuffer();
    const expected=mode===0?403:mode===1?401:mode===4?404:400;
    verify('http-seguranca',index,()=>{
     assert.equal(status,expected,'Status inesperado no cenário HTTP '+mode);
    });
   }
  }
  await Promise.all(Array.from({length:concurrency},()=>worker()));
  const unchanged=await admin.query(
   'SELECT COUNT(*)::int AS n FROM project_budget_stages WHERE project_id=$1',
   [projectId]);
  assert.equal(unchanged.rows[0].n,1,'HTTP alterou etapas em casos negativos');
  const count=await admin.query(
   'SELECT COUNT(*)::int AS n FROM project_budget_items WHERE project_id=$1',
   [projectId]);
  assert.equal(count.rows[0].n,500,'HTTP alterou itens em casos negativos');
 }finally{
  try{
   if(cities.length){
    for(const table of ['project_budget_events','project_budget_items',
      'project_budget_stages']){
     await admin.query('DELETE FROM '+table+' WHERE municipality_id=ANY($1::uuid[])',[cities]);
    }
   }
   if(projectIds.length)
    await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projectIds]);
   if(cities.length)
    await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   if(userIds.length)
    await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[userIds]);
   if(cities.length)
    await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
}
try{
 baseCases();
 await infrastructureCases();
 assert.deepEqual(counts,expectedCategories,'Cobertura de casos incompleta');
 assert.equal(passed,TARGET,'Quantidade de cenários diferente do solicitado');
 const summary={seed:SEED,passed,total:TARGET,failed:0,categories:counts,
  environment:'PostgreSQL de teste isolado e HTTP localhost'};
 console.log('AXE_FOMENTO_10000_TESTES='+JSON.stringify(summary));
}catch(error){
 console.error('FALHA NA BATERIA DE 10000 CASOS:',error?.stack||error);
 console.error('AXE_FOMENTO_10000_PARCIAL='+JSON.stringify({seed:SEED,passed,failed:1,categories:counts}));
 process.exitCode=1;
}
