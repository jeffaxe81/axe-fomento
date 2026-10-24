import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// Use only against an explicitly designated disposable test database.
if (process.env.RUN_TEST_DB_ISOLATION !== 'yes') {
  throw new Error('Defina RUN_TEST_DB_ISOLATION=yes somente em ambiente de testes isolado.');
}
if (!process.env.DATABASE_ADMIN_URL || !process.env.TEST_BASE_URL) {
  throw new Error('DATABASE_ADMIN_URL e TEST_BASE_URL são obrigatórios.');
}

test('Prefeituras A e B não compartilham projetos ou edições de perfil', async () => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await db.connect();
  const base = process.env.TEST_BASE_URL;
  const suffix = randomUUID().slice(0, 8);
  const password = 'Somente-Teste-Fomento-2026!';
  const hash = await bcrypt.hash(password, 10);
  const aEmail = 'fomento-a-' + suffix + '@example.invalid';
  const bEmail = 'fomento-b-' + suffix + '@example.invalid';
  const projectName = 'projeto-privado-a-' + suffix;
  let a = null;
  let b = null;
  let opportunity = null;
  try {
    a = (await db.query("INSERT INTO municipalities(name, uf, population) VALUES ($1,'SC',1000) RETURNING id", ['Teste A ' + suffix])).rows[0].id;
    b = (await db.query("INSERT INTO municipalities(name, uf, population) VALUES ($1,'RS',2000) RETURNING id", ['Teste B ' + suffix])).rows[0].id;
    const aUser = (await db.query("INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES ($1,$2,$3,$4,'admin') RETURNING id", [a,'Teste Admin A',aEmail,hash])).rows[0].id;
    const bUser = (await db.query("INSERT INTO users(municipality_id,full_name,email,password_hash,role) VALUES ($1,$2,$3,$4,'analyst') RETURNING id", [b,'Teste Analista B',bEmail,hash])).rows[0].id;
    opportunity = (await db.query("INSERT INTO opportunities(title,provider,is_example) VALUES ($1,'Fonte de teste',true) RETURNING id", ['Oportunidade fictícia ' + suffix])).rows[0].id;
    await db.query('INSERT INTO projects(municipality_id,opportunity_id,title,owner_user_id) VALUES ($1,$2,$3,$4)', [a,opportunity,projectName,aUser]);

    const asUser = async (email) => {
      const res = await fetch(base + '/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      assert.equal(res.status, 200, 'Login esperado para ' + email);
      const cookie = res.headers.get('set-cookie');
      assert.ok(cookie, 'Login deve retornar cookie de sessão');
      return cookie.split(';')[0];
    };
    const cookieA = await asUser(aEmail);
    const cookieB = await asUser(bEmail);
    const headersA = { cookie: cookieA, 'content-type': 'application/json' };
    const headersB = { cookie: cookieB, 'content-type': 'application/json' };
    const viewA = await fetch(base + '/projetos', { headers: { cookie: cookieA } });
    const viewB = await fetch(base + '/projetos?municipality_id=' + a, { headers: { cookie: cookieB } });
    assert.equal(viewA.status, 200);
    assert.equal(viewB.status, 200);
    assert.ok((await viewA.text()).includes(projectName), 'Prefeitura A vê seu próprio projeto');
    assert.ok(!(await viewB.text()).includes(projectName), 'Prefeitura B não pode consultar projeto de A');

    const crossTenantMarker = 'projeto-exclusivo-b-' + suffix;
    const createBMarker = await fetch(base + '/api/projects', {
      method: 'POST', headers: headersB,
      body: JSON.stringify({ title: crossTenantMarker, opportunityId: opportunity })
    });
    assert.equal(createBMarker.status, 201, 'Prefeitura B cria projeto próprio');
    const bPage = await fetch(base + '/projetos', { headers: { cookie: cookieB } });
    const aPage = await fetch(base + '/projetos', { headers: { cookie: cookieA } });
    assert.ok((await bPage.text()).includes(crossTenantMarker), 'Prefeitura B visualiza seu projeto');
    assert.ok(!(await aPage.text()).includes(crossTenantMarker), 'Prefeitura A não visualiza projeto de B');

    const anon = await fetch(base + '/api/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Sem sessão', opportunityId: opportunity })
    });
    assert.equal(anon.status, 401, 'Criação sem sessão deve falhar');

    const forgedTitle = 'projeto-criado-por-b-' + suffix;
    const create = await fetch(base + '/api/projects', {
      method: 'POST', headers: headersB,
      body: JSON.stringify({ title: forgedTitle, opportunityId: opportunity, municipality_id: a })
    });
    assert.equal(create.status, 201, 'Usuário B deve poder criar apenas em seu município');
    const created = await create.json();
    const createdRow = (await db.query('SELECT municipality_id, title FROM projects WHERE id=$1', [created.id])).rows[0];
    assert.equal(createdRow.municipality_id, b, 'Servidor deve ignorar município forjado no corpo');
    assert.equal(createdRow.title, forgedTitle);
    const [createdAudit] = (await db.query(
      "SELECT actor_user_id,municipality_id FROM audit_events WHERE action='project.insert' AND record_id=$1",
      [created.id]
    )).rows;
    assert.equal(createdAudit.actor_user_id, bUser, 'A autoria da criação deve ficar registrada');
    assert.equal(createdAudit.municipality_id, b, 'Auditoria deve permanecer no município B');

    // Testes negativos: parâmetros maliciosos nunca devem virar comandos SQL/HTML.
    const badUuid = await fetch(base + '/api/projects', {
      method: 'POST', headers: headersB,
      body: JSON.stringify({ title: 'Tentativa de injeção', opportunityId: "' OR 1=1 --" })
    });
    assert.equal(badUuid.status, 400, 'Identificadores malformados são recusados');
    const oversized = await fetch(base + '/api/projects', {
      method: 'POST', headers: headersB,
      body: JSON.stringify({ title: 'a'.repeat(181), opportunityId: opportunity })
    });
    assert.equal(oversized.status, 400, 'Títulos acima do limite são recusados');

    const injectionTitle = "Tentativa '); DROP TABLE users; -- <img src=x onerror=alert(1)>";
    const injectionCreate = await fetch(base + '/api/projects', {
      method: 'POST', headers: headersB,
      body: JSON.stringify({ title: injectionTitle, opportunityId: opportunity })
    });
    assert.equal(injectionCreate.status, 201, 'Texto informado deve ser armazenado como dado');
    const injectionRow = (await db.query('SELECT title FROM projects WHERE id=$1', [(await injectionCreate.json()).id])).rows[0];
    assert.equal(injectionRow.title, injectionTitle);
    assert.ok((await db.query('SELECT count(*) FROM users')).rows.length, 'Tabela de usuários permanece acessível');
    const attackPage = await fetch(base + '/projetos', { headers: { cookie: cookieB } });
    assert.equal(attackPage.status, 200);
    assert.ok(!(await attackPage.text()).includes('<img src=x onerror=alert(1)>'), 'HTML malicioso não pode ser interpretado pelo navegador');

    const forbidden = await fetch(base + '/api/municipality', {
      method: 'PATCH', headers: headersB,
      body: JSON.stringify({ ibgeCode: null, population: 98765, priorityAreas: ['segurança'] })
    });
    assert.equal(forbidden.status, 403, 'Analista não deve editar perfil institucional');

    const editA = await fetch(base + '/api/municipality', {
      method: 'PATCH', headers: headersA,
      body: JSON.stringify({ ibgeCode: null, population: 43210, priorityAreas: ['saúde'] })
    });
    assert.equal(editA.status, 200, 'Administrador pode editar seu próprio município');
    const municipalData = await db.query('SELECT id, population FROM municipalities WHERE id = ANY($1::uuid[])', [[a, b]]);
    const populations = new Map(municipalData.rows.map(row => [row.id, row.population]));
    assert.equal(populations.get(a), 43210, 'Edição deve alcançar somente A');
    assert.equal(populations.get(b), 2000, 'Edição de A não pode afetar B');
    const [editAudit] = (await db.query(
      "SELECT actor_user_id FROM audit_events WHERE action='municipality.update' AND record_id=$1 ORDER BY id DESC LIMIT 1",
      [a]
    )).rows;
    assert.equal(editAudit.actor_user_id, aUser, 'Edição do perfil deve indicar administrador autenticado');
  } finally {
    try {
      if (a || b) {
        const ids = [a, b].filter(Boolean);
        await db.query('DELETE FROM projects WHERE municipality_id = ANY($1::uuid[])', [ids]);
        await db.query('DELETE FROM users WHERE municipality_id = ANY($1::uuid[])', [ids]);
        await db.query('DELETE FROM municipalities WHERE id = ANY($1::uuid[])', [ids]);
      }
      if (opportunity) await db.query('DELETE FROM opportunities WHERE id=$1', [opportunity]);
    } finally {
      await db.end();
    }
  }
});
