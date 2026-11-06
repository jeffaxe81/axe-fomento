import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {formatBRLCents} from '../../lib/financial-money.mjs';
import {budgetLineTotalCents} from '../../lib/budget-math.mjs';

if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL||
 !process.env.DATABASE_URL||!process.env.TEST_BASE_URL)
 throw new Error('AF-025 exige banco e serviço descartáveis no CI.');

test('AF-025: etapas, itens, soma exata, tenant, auditoria e permissões',async t=>{
 const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
 const app=new pg.Client({connectionString:process.env.DATABASE_URL});
 await admin.connect();await app.connect();
 const base=process.env.TEST_BASE_URL,tag=randomUUID().slice(0,8);
 const cities=[],users=[],projects=[];
 const secret='Somente-Testes-Orcamento-2026!',hash=await bcrypt.hash(secret,10);
 async function city(suffix){
  const x=await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
   ['Budget '+tag+' '+suffix]);cities.push(x.rows[0].id);return x.rows[0].id;
 }
 async function actor(municipality,label,role){
  const email='budget-'+tag+'-'+label+'@example.invalid';
  const user=(await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash,role) '+
   'VALUES($1,$2,$3,$4,$5) RETURNING id',
   [municipality,'Budget '+label,email,hash,role])).rows[0];
  users.push(user.id);
  const response=await fetch(base+'/api/auth/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({email,password:secret})});
  assert.equal(response.status,200);
  return {id:user.id,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 async function project(municipality,owner,label){
  const x=await admin.query('INSERT INTO projects(municipality_id,owner_user_id,title) '+
   'VALUES($1,$2,$3) RETURNING id',[municipality,owner,'Budget '+label+' '+tag]);
  projects.push(x.rows[0].id);return x.rows[0].id;
 }
 async function api(path,body,who,origin=base){
  const response=await fetch(base+path,{method:'POST',headers:{
   origin,'content-type':'application/json',...(who?.cookie?{cookie:who.cookie}:{})
  },body:JSON.stringify(body)});
  let parsed;const raw=await response.text();
  try{parsed=JSON.parse(raw);}catch{parsed={error:raw.slice(0,200)};}
  return {status:response.status,body:parsed};
 }
 async function page(path,who){
  const response=await fetch(base+path,{redirect:'manual',
   headers:who?.cookie?{cookie:who.cookie}:{}});
  return {status:response.status,html:await response.text()};
 }
 function simulationPanel(html){
  // Match the visible section, without confusing its values with AF-025 or the Next.js payload.
  const panel=html.match(/<section\b[^>]*\baria-labelledby="counterpart-simulation-title"[^>]*>[\s\S]*?<\/section>/);
  assert.ok(panel,'A página deve renderizar o painel de simulação de contrapartida');
  assert.match(panel[0],/<h2\b[^>]*>Simulação de contrapartida<\/h2>/);
  return panel[0];
 }
 try{
  const a=await city('A'),b=await city('B');
  const owner=await actor(a,'owner','analyst');
  const adminA=await actor(a,'admin','admin');
  const outsider=await actor(a,'outsider','analyst');
  const foreign=await actor(b,'foreign','admin');
  const projectA=await project(a,owner.id,'Projeto A');
  const otherA=await project(a,outsider.id,'Outro A');
  const projectB=await project(b,foreign.id,'Projeto B');
  const stagePath='/api/projects/budget/stages',itemPath='/api/projects/budget/items';
  const stageInput={projectId:projectA,stageNumber:1,title:'Projeto executivo '+tag,
   startsOn:'2027-01-02',endsOn:'2027-05-30',
   assumptions:'Cronograma proposto pela equipe municipal; custos não homologados.'};
  let stageId;
  await t.test('etapa: titularidade, tenant, período, conflito e interface',async()=>{
   assert.equal((await api(stagePath,stageInput)).status,401);
   assert.equal((await api(stagePath,stageInput,outsider)).status,404);
   assert.equal((await api(stagePath,stageInput,foreign)).status,404);
   assert.equal((await api(stagePath,stageInput,owner,'https://site.invalid')).status,403);
   assert.equal((await api(stagePath,{...stageInput,municipalityId:b},owner)).status,400);
   assert.equal((await api(stagePath,{...stageInput,startsOn:'2027-02-30'},owner)).status,400);
   assert.equal((await api(stagePath,{...stageInput,endsOn:'2026-01-01'},owner)).status,400);
   assert.equal((await api(stagePath,{...stageInput,stageNumber:201},owner)).status,400);
   assert.equal((await api(stagePath,{...stageInput,projectId:projectB},adminA)).status,404);
   const saved=await api(stagePath,stageInput,owner);
   assert.equal(saved.status,201);stageId=saved.body.id;assert.ok(stageId);
   assert.equal((await api(stagePath,stageInput,owner)).status,409);
   const separate=await api(stagePath,{
    ...stageInput,stageNumber:2,title:'Segunda etapa '+tag
   },adminA);
   assert.equal(separate.status,201);
   const otherStage=await api(stagePath,{
    ...stageInput,projectId:otherA,title:'Etapa outro projeto '+tag
   },outsider);
   assert.equal(otherStage.status,201);
   const p=await page('/projetos/'+projectA+'/orcamento',owner);
   assert.equal(p.status,200);assert.ok(p.html.includes('Projeto executivo '+tag));
   assert.ok(p.html.includes('Conciliado entre etapas e itens'));
   assert.match(simulationPanel(p.html),/Cadastre itens no orçamento/);
   assert.equal((await page('/projetos/'+projectA+'/orcamento',foreign)).status,404);
   assert.equal((await page('/projetos/'+projectA+'/orcamento')).status,307);
  });
  await t.test('itens: cálculo preciso, escopo, limite e duplicidade',async()=>{
   const input={projectId:projectA,stageId,lineNumber:1,
    title:'Equipamento técnico '+tag,unit:'un',
    quantity:'1,500',unitCost:'10,01',
    assumptions:'Pesquisa de mercado manual e quantidades declaradas para o teste.'};
   assert.equal((await api(itemPath,input)).status,401);
   assert.equal((await api(itemPath,input,outsider)).status,404);
   assert.equal((await api(itemPath,input,foreign)).status,404);
   assert.equal((await api(itemPath,{...input,projectId:otherA},adminA)).status,404);
   assert.equal((await api(itemPath,{...input,stageId:randomUUID()},owner)).status,404);
   assert.equal((await api(itemPath,{...input,quantity:'1,5001'},owner)).status,400);
   assert.equal((await api(itemPath,{...input,quantity:'0'},owner)).status,400);
   assert.equal((await api(itemPath,{...input,unitCost:'1.234,56'},owner)).status,400);
   assert.equal((await api(itemPath,{...input,unit:'bitcoin'},owner)).status,400);
   assert.equal((await api(itemPath,{...input,quantity:'999999,999',
    unitCost:'999999999999,99'},owner)).status,400);
   assert.equal((await api(itemPath,input,owner,'https://site.invalid')).status,403);
   const first=await api(itemPath,input,owner);
   assert.equal(first.status,201);assert.equal(first.body.totalCents,'1502');
   assert.equal((await api(itemPath,input,owner)).status,409);
   const second=await api(itemPath,{...input,lineNumber:2,
    title:'Serviço sem desembolso '+tag,
    quantity:'0,001',unitCost:'0,00',unit:'servico'},owner);
   assert.equal(second.status,201);assert.equal(second.body.totalCents,'0');
   const third=await api(itemPath,{...input,lineNumber:3,
    title:'Material estimado '+tag,
    quantity:'2,500',unitCost:'99,95',unit:'kg'},adminA);
   assert.equal(third.status,201);assert.equal(third.body.totalCents,'24988');
   const lines=await admin.query(
    'SELECT line_number,quantity_milli,unit_cost_cents,line_total_cents '+
    'FROM project_budget_items WHERE stage_id=$1 ORDER BY line_number',[stageId]);
   assert.deepEqual(lines.rows.map(x=>x.line_number),[1,2,3]);
   assert.deepEqual(lines.rows.map(x=>x.line_total_cents),['1502','0','24988']);
   assert.equal(lines.rows[0].quantity_milli,'1500');
   assert.equal(lines.rows[0].unit_cost_cents,'1001');
   assert.equal(budgetLineTotalCents('2500','9995'),'24988');
   const sum=(await admin.query('SELECT SUM(line_total_cents)::text AS total '+
    'FROM project_budget_items WHERE stage_id=$1',[stageId])).rows[0].total;
   assert.equal(sum,'26490');assert.equal(formatBRLCents(sum),'R$ 264,90');
   const html=(await page('/projetos/'+projectA+'/orcamento',owner)).html;
   assert.ok(html.includes('R$ 264,90'));
   assert.ok(html.includes('1,5'));
   assert.ok(html.includes('R$ 10,01'));
   assert.ok(html.includes('Material estimado '+tag));
   assert.ok(html.includes('Conciliado entre etapas e itens'));
  });
  await t.test('AF-026: simulação usa o total do orçamento e respeita o município',async()=>{
   const budgetPath='/projetos/'+projectA+'/orcamento';
   const own=await page(budgetPath,owner);
   assert.equal(own.status,200);
   const panel=simulationPanel(own.html);
   const budgetBase=panel.match(
    /<dt[^>]*>Total do orçamento usado na simulação<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/);
   assert.equal(budgetBase?.[1].replace(/<[^>]+>/g,'').trim(),'R$ 264,90');
   assert.match(panel,/Percentual/);
   assert.match(panel,/Disponível/);
   assert.doesNotMatch(panel,/Cadastre itens no orçamento/);
   const denied=await page(budgetPath,foreign);
   assert.equal(denied.status,404);
   assert.doesNotMatch(denied.html,/Simulação de contrapartida|R\$ 264,90/);
   const foreignOwn=await page('/projetos/'+projectB+'/orcamento',foreign);
   assert.equal(foreignOwn.status,200);
   const foreignPanel=simulationPanel(foreignOwn.html);
   assert.match(foreignPanel,/Cadastre itens no orçamento/);
   assert.doesNotMatch(foreignPanel,/R\$ 264,90/);
  });
  await t.test('eventos insert-only, RLS forçada e composição do total',async()=>{
   const stages=(await admin.query('SELECT COUNT(*)::int AS total FROM project_budget_stages '+
    'WHERE project_id=$1',[projectA])).rows[0].total;
   assert.equal(stages,2);
   const events=(await admin.query('SELECT action,amount_cents FROM project_budget_events '+
    'WHERE project_id=$1 ORDER BY recorded_at,id',[projectA])).rows;
   assert.equal(events.filter(e=>e.action==='etapa_criada').length,2);
   assert.deepEqual(events.filter(e=>e.action==='item_adicionado')
    .map(e=>e.amount_cents).sort(),['0','1502','24988'].sort());
   const all=(await admin.query('SELECT SUM(line_total_cents)::text AS sum FROM '+
    'project_budget_items WHERE project_id=$1',[projectA])).rows[0].sum;
   const sub=(await admin.query('SELECT SUM(subtotal)::text AS sum FROM '+
    '(SELECT SUM(line_total_cents) AS subtotal FROM project_budget_items '+
    'WHERE project_id=$1 GROUP BY stage_id) x',[projectA])).rows[0].sum;
   assert.equal(all,sub);
   assert.equal((await app.query('SELECT * FROM project_budget_items')).rowCount,0);
   await app.query('BEGIN');
   try{
    await app.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
    await app.query("SELECT set_config('app.actor_id',$1,true)",[foreign.id]);
    assert.equal((await app.query('SELECT * FROM project_budget_items')).rowCount,0);
    assert.equal((await app.query('SELECT * FROM project_budget_stages')).rowCount,0);
    assert.equal((await app.query('SELECT * FROM project_budget_events')).rowCount,0);
    for(const [sql,params] of [
     ['UPDATE project_budget_items SET title=$1 WHERE stage_id=$2',
      ['Tentativa de alteração maliciosa',stageId]],
     ['DELETE FROM project_budget_events WHERE stage_id=$1',[stageId]]
    ]){
     await app.query('SAVEPOINT denied');
     await assert.rejects(app.query(sql,params),/permission denied/i);
     await app.query('ROLLBACK TO SAVEPOINT denied');
    }
   }finally{await app.query('ROLLBACK');}
  });
 }finally{
  try{
   if(cities.length){
    for(const table of ['project_budget_events','project_budget_items',
     'project_budget_stages'])
     await admin.query('DELETE FROM '+table+' WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(projects.length)await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projects]);
   if(cities.length){
    await admin.query('DELETE FROM audit_events WHERE municipality_id=ANY($1::uuid[])',[cities]);
   }
   if(users.length)await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
   if(cities.length)await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cities]);
  }finally{await app.end();await admin.end();}
 }
});
