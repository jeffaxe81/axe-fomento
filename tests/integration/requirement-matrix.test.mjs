import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { ASSESS_REQUIREMENT_SQL } from '../../lib/requirement-assessment-sql.mjs';

if (process.env.RUN_TEST_DB_ISOLATION !== 'yes' || !process.env.DATABASE_ADMIN_URL ||
    !process.env.DATABASE_URL || !process.env.TEST_BASE_URL) {
  throw new Error('Matriz de requisitos exige banco descartável e servidor de testes.');
}

test('AF-013/014: matriz, diagnóstico e auditoria por projeto e município', async (t) => {
  const admin = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect(); await app.connect();
  const suffix = randomUUID().slice(0, 8);
  const base = process.env.TEST_BASE_URL;
  const cityIds = [], userIds = [], opportunityIds = [], projectIds = [];
  const password = 'Teste-Requisitos-Somente-2026!';
  const hash = await bcrypt.hash(password, 10);

  async function createCity(label) {
    const result = await admin.query("INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
      ['Req-' + suffix + label]);
    cityIds.push(result.rows[0].id);
    return result.rows[0].id;
  }
  async function createActor(cityId, label, role) {
    const email = 'requisitos-' + suffix + '-' + label + '@example.invalid';
    const result = await admin.query(
      'INSERT INTO users(municipality_id,full_name,email,password_hash,role) ' +
      'VALUES($1,$2,$3,$4,$5) RETURNING id',
      [cityId, 'Teste ' + label, email, hash, role]);
    userIds.push(result.rows[0].id);
    const login = await fetch(base + '/api/auth/login', {
      method:'POST', headers:{'content-type':'application/json'},body:JSON.stringify({email,password}),
    });
    assert.equal(login.status, 200);
    return {id:result.rows[0].id,cityId,cookie:login.headers.get('set-cookie')?.split(';')[0]};
  }
  async function post(path, body, as, method = 'POST', origin = base) {
    const response = await fetch(base + path, {method,
      headers:{'content-type':'application/json',origin,...(as?.cookie ? {cookie:as.cookie}: {})},
      body:JSON.stringify(body)});
    return {status:response.status, json:await response.json()};
  }
  async function page(path, as) {
    const response = await fetch(base+path, {
      headers:as?.cookie?{cookie:as.cookie}:{},redirect:'manual',
    });
    return {status:response.status,html:await response.text(),location:response.headers.get('location')};
  }
  async function createProject(cityId, actorId, opportunityId, title) {
    const result=await admin.query(
      'INSERT INTO projects(municipality_id,owner_user_id,opportunity_id,title) ' +
      'VALUES($1,$2,$3,$4) RETURNING id',
      [cityId,actorId,opportunityId,title]);
    projectIds.push(result.rows[0].id);
    return result.rows[0].id;
  }
  const url = 'https://example.invalid/edital/revisao-' + suffix;
  function ruleBody(opportunityId) {
    return {
      opportunityId, requirement:'Comprovar existência de unidade de atendimento municipal.',
      mandatory:true, sourceUrl:url, sourceVersion:'Retificação 01 de teste',
      sourceSection:'Item 4.2 - teste',
      evidenceExcerpt:'Documento fictício: exigência de comprovação para fins exclusivos de teste.',
    };
  }
  try {
    const cityA=await createCity('A'), cityB=await createCity('B');
    const aAdmin=await createActor(cityA,'admin-a','admin');
    const aAnalyst=await createActor(cityA,'analyst-a','analyst');
    const bAdmin=await createActor(cityB,'admin-b','admin');
    const results=await admin.query(
      "INSERT INTO opportunities(title,provider,is_example) VALUES($1,'Fonte teste',true),($2,'Fonte teste',true) RETURNING id",
      ['Oportunidade requisitos '+suffix, 'Outra oportunidade '+suffix]);
    opportunityIds.push(...results.rows.map(x=>x.id));
    const [opA,opB]=opportunityIds;
    const projectA=await createProject(cityA,aAnalyst.id,opA,'Projeto requisitos A '+suffix);
    const projectAOther=await createProject(cityA,aAnalyst.id,opB,'Projeto outra oportunidade A '+suffix);
    const projectB=await createProject(cityB,bAdmin.id,opA,'Projeto exclusivo B '+suffix);
    const path='/projetos/'+projectA+'/requisitos';

    await t.test('página inicia com zero critérios, sem inventar elegibilidade',async()=>{
      const response=await page(path,aAnalyst);
      assert.equal(response.status,200);
      assert.ok(response.html.includes('Requisitos do projeto'));
      assert.ok(response.html.includes('Pendente'));
      assert.ok(response.html.includes('FICTÍCIO / TESTE'));
      assert.ok(!response.html.includes('Comprovar existência de unidade'));
      assert.equal((await page(path,bAdmin)).status,404);
      const anonymous=await page(path);
      assert.equal(anonymous.status,307);
      assert.equal(anonymous.location,'/login');
      assert.equal((await page('/projetos/uuid-invalido/requisitos',aAdmin)).status,404);
    });

    let ruleA,ruleB;
    await t.test('cadastra requisito com fonte e versão, apenas por administrador',async()=>{
      const route='/api/requirements';
      const valid=ruleBody(opA);
      assert.equal((await post(route,valid)).status,401);
      assert.equal((await post(route,valid,aAnalyst)).status,403);
      assert.equal((await post(route,{...valid,sourceUrl:'javascript:alert(1)'},aAdmin)).status,400);
      assert.equal((await post(route,{...valid,evidenceExcerpt:'curto'},aAdmin)).status,400);
      assert.equal((await post(route,{...valid,municipalityId:cityB},aAdmin)).status,400);
      assert.equal((await post(route,valid,aAdmin,'POST','https://invasor.invalid')).status,403);
      const created=await post(route,valid,aAdmin);
      assert.equal(created.status,201);
      ruleA=created.json.id;
      const other=await post(route,{...valid,requirement:'Outro requisito exclusivo do município B.'},bAdmin);
      assert.equal(other.status,201);
      ruleB=other.json.id;
      assert.notEqual(ruleA,ruleB);
      const pageA=await page(path,aAnalyst);
      assert.equal(pageA.status,200);
      assert.ok(pageA.html.includes(valid.requirement));
      assert.ok(pageA.html.includes(valid.sourceSection));
      assert.ok(pageA.html.includes(valid.evidenceExcerpt));
      assert.ok(pageA.html.includes('não verificada'));
      assert.ok(!pageA.html.includes('Outro requisito exclusivo do município B'));
      const pageB=await page('/projetos/'+projectB+'/requisitos',bAdmin);
      assert.ok(pageB.html.includes('Outro requisito exclusivo do município B'));
      assert.ok(!pageB.html.includes(valid.requirement));
    });

    await t.test('diagnóstico exige evidência, mesma oportunidade e município',async()=>{
      const route='/api/projects/requirements';
      const valid={projectId:projectA,requirementId:ruleA,status:'atendido',
        evidenceNote:'Declaração informada para teste, ainda não validada.'};
      assert.equal((await post(route,valid,undefined,'PUT')).status,401);
      assert.equal((await post(route,{...valid,evidenceNote:''},aAnalyst,'PUT')).status,400);
      assert.equal((await post(route,{...valid,status:'inexistente'},aAnalyst,'PUT')).status,400);
      assert.equal((await post(route,{...valid,municipalityId:cityB},aAnalyst,'PUT')).status,400);
      assert.equal((await post(route,valid,aAnalyst,'PUT','https://invasor.invalid')).status,403);
      assert.equal((await post(route,{...valid,projectId:projectAOther},aAnalyst,'PUT')).status,404);
      assert.equal((await post(route,{...valid,projectId:projectB},aAnalyst,'PUT')).status,404);
      assert.equal((await post(route,{...valid,requirementId:ruleB},aAnalyst,'PUT')).status,404);
      const first=await post(route,valid,aAnalyst,'PUT');
      assert.equal(first.status,200);assert.equal(first.json.changed,true);
      const again=await post(route,valid,aAnalyst,'PUT');
      assert.equal(again.status,200);assert.equal(again.json.changed,false);
      assert.equal((await admin.query('SELECT 1 FROM project_requirement_events WHERE project_id=$1',[projectA])).rowCount,1);
      let response=await page(path,aAdmin);
      assert.ok(response.html.includes('Atendido (declarado)'));
      assert.ok(response.html.includes(valid.evidenceNote));
      assert.equal((await post(route,{...valid,status:'nao_atendido',
        evidenceNote:'Não há comprovante disponível até o momento.'},aAnalyst,'PUT')).status,200);
      response=await page(path,aAnalyst);
      assert.ok(response.html.includes('Não atendido (declarado)'));
      assert.equal((await post(route,{...valid,status:'pendente',evidenceNote:''},aAnalyst,'PUT')).status,200);
      assert.equal((await admin.query('SELECT 1 FROM project_requirement_events WHERE project_id=$1',[projectA])).rowCount,3);
      assert.ok((await page(path,aAnalyst)).html.includes('Pendente de comprovação'));
    });

    await t.test('PostgreSQL bloqueia ausência de contexto e leitura de outra prefeitura',async()=>{
      assert.equal((await app.query('SELECT * FROM opportunity_requirements')).rowCount,0);
      assert.equal((await app.query('SELECT * FROM project_requirement_assessments')).rowCount,0);
      assert.equal((await app.query('SELECT * FROM project_requirement_events')).rowCount,0);
      await app.query('BEGIN');
      try{
        await app.query("SELECT set_config('app.tenant_id',$1,true)",[cityA]);
        await app.query("SELECT set_config('app.actor_id',$1,true)",[aAnalyst.id]);
        assert.deepEqual((await app.query('SELECT id FROM opportunity_requirements')).rows.map(x=>x.id),[ruleA]);
        await app.query('SAVEPOINT tenant_guard');
        await assert.rejects(app.query(
          'INSERT INTO opportunity_requirements(municipality_id,opportunity_id,requirement,source_url,source_version,source_section,evidence_excerpt,created_by) '+
          'VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [cityB,opA,'Regra fictícia proibida de outra prefeitura',url,'V1','Item 1',
            'Trecho de teste de acesso cruzado',bAdmin.id]),/row-level security/i);
        await app.query('ROLLBACK TO SAVEPOINT tenant_guard');
        const result=await app.query(ASSESS_REQUIREMENT_SQL,
          [cityA,projectA,ruleB,'pendente','',aAnalyst.id]);
        assert.equal(result.rows[0].applicable,false);
      } finally {await app.query('ROLLBACK');}
      assert.equal((await app.query('SELECT * FROM opportunity_requirements')).rowCount,0);
    });
  } finally {
    try{
      if(projectIds.length) await admin.query('DELETE FROM projects WHERE id=ANY($1::uuid[])',[projectIds]);
      if(cityIds.length) await admin.query(
        'DELETE FROM opportunity_requirements WHERE municipality_id=ANY($1::uuid[])',[cityIds]);
      if(userIds.length) await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[userIds]);
      if(cityIds.length) await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])',[cityIds]);
      if(opportunityIds.length) await admin.query('DELETE FROM opportunities WHERE id=ANY($1::uuid[])',[opportunityIds]);
    } finally {await app.end();await admin.end();}
  }
});
