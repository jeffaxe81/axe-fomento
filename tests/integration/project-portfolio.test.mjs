import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if (process.env.RUN_TEST_DB_ISOLATION !== 'yes' || !process.env.DATABASE_ADMIN_URL || !process.env.TEST_BASE_URL) {
  throw new Error('A suíte exige um banco descartável e o servidor de testes.');
}

test('Carteira municipal: busca, filtro, paginação e ficha do projeto', async (t) => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await db.connect();
  const base = process.env.TEST_BASE_URL;
  const suffix = randomUUID().slice(0, 8);
  const prefix = 'Carteira-' + suffix;
  const opportunityTitle = 'Fonte fictícia ' + suffix;
  const password = 'Somente-Teste-Carteira-2026!';
  const titles = Array.from({ length: 30 }, (_, i) => prefix + ' projeto ' + String(i + 1).padStart(2, '0'));
  titles[0] += ' %_';
  const cities = [];
  let opportunityId;

  async function createCity(label, hash) {
    const name = prefix + ' ' + label;
    const { rows: [city] } = await db.query(
      "INSERT INTO municipalities(name, uf) VALUES ($1, 'SC') RETURNING id",
      [name],
    );
    cities.push(city.id);
    const email = prefix.toLowerCase() + '-' + label.toLowerCase() + '@example.invalid';
    const { rows: [user] } = await db.query(
      'INSERT INTO users(municipality_id, full_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
      [city.id, name, email, hash],
    );
    const response = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie);
    return { id: city.id, userId: user.id, name, cookie: cookie.split(';')[0] };
  }

  async function getPage(path, city) {
    const response = await fetch(base + path, {
      headers: city ? { cookie: city.cookie } : {},
      redirect: 'manual',
    });
    return { status: response.status, html: await response.text(), location: response.headers.get('location') };
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const cityA = await createCity('A', hash);
    const cityB = await createCity('B', hash);
    const { rows: [opportunity] } = await db.query(
      "INSERT INTO opportunities(title, provider, is_example) VALUES ($1, 'Fonte de teste', true) RETURNING id",
      [opportunityTitle],
    );
    opportunityId = opportunity.id;
    const { rows: projects } = await db.query(
      'INSERT INTO projects (municipality_id, owner_user_id, opportunity_id, title, status, created_at) ' +
      "SELECT $1, $2, $3, title, CASE WHEN n IN (6, 30) THEN 'preparacao' ELSE 'rascunho' END, " +
      "TIMESTAMPTZ '2026-10-01 12:00:00Z' + n * INTERVAL '1 minute' " +
      'FROM unnest($4::text[]) WITH ORDINALITY AS input(title, n) RETURNING id, title',
      [cityA.id, cityA.userId, opportunityId, titles],
    );
    const cityBTitle = 'Projeto exclusivo da prefeitura B ' + suffix;
    await db.query(
      'INSERT INTO projects(municipality_id, owner_user_id, title) VALUES ($1, $2, $3)',
      [cityB.id, cityB.userId, cityBTitle],
    );

    await t.test('busca por título ignora caixa e mantém % e _ literais', async () => {
      const byTitle = await getPage('/projetos?busca=' + encodeURIComponent(titles[26].toUpperCase()), cityA);
      assert.equal(byTitle.status, 200);
      assert.ok(byTitle.html.includes(titles[26]));
      assert.ok(!byTitle.html.includes(titles[25]));
      const literal = await getPage('/projetos?busca=%25_', cityA);
      assert.equal(literal.status, 200);
      assert.ok(literal.html.includes(titles[0]));
      assert.ok(!literal.html.includes(titles[1]));
    });

    await t.test('combina filtro por situação e termo de busca', async () => {
      const path = '/projetos?busca=' + prefix + '&situacao=preparacao';
      const filtered = await getPage(path, cityA);
      assert.equal(filtered.status, 200);
      assert.ok(filtered.html.includes(titles[29]));
      assert.ok(filtered.html.includes(titles[5]));
      assert.ok(!filtered.html.includes(titles[28]));
      const forged = await getPage(path + '&municipality_id=' + cityA.id, cityB);
      assert.equal(forged.status, 200);
      assert.ok(!forged.html.includes(titles[29]));
    });

    await t.test('paginação estável preserva filtros e permite voltar de página vazia', async () => {
      const filters = 'busca=' + prefix + '&situacao=rascunho';
      const first = await getPage('/projetos?' + filters, cityA);
      assert.equal(first.status, 200);
      assert.ok(first.html.includes(titles[28]));
      assert.ok(!first.html.includes(titles[0]));
      assert.ok(first.html.includes('href="/projetos?' + filters.replace('&', '&amp;') + '&amp;pagina=2"'));

      const second = await getPage('/projetos?' + filters + '&pagina=2', cityA);
      assert.equal(second.status, 200);
      assert.ok(second.html.includes(titles[0]));
      assert.ok(!second.html.includes(titles[28]));
      assert.ok(!second.html.includes(titles[5]));

      const empty = await getPage('/projetos?' + filters + '&pagina=999', cityA);
      assert.equal(empty.status, 200);
      assert.ok(!empty.html.includes(titles[0]));
      assert.ok(empty.html.includes('href="/projetos?' + filters.replace('&', '&amp;') + '"'));
    });

    await t.test('parâmetros inválidos voltam para a primeira página sem filtro de situação', async () => {
      const page = await getPage('/projetos?situacao=constructor&pagina=-3&busca=%00', cityA);
      assert.equal(page.status, 200);
      assert.ok(page.html.includes(titles[29]));
      assert.ok(!page.html.includes(titles[0]));
    });

    await t.test('ficha própria abre pelo portfólio e nega acesso de outro município', async () => {
      const project = projects.find((item) => item.title === titles[26]);
      assert.ok(project);
      const path = '/projetos/' + project.id;
      const list = await getPage('/projetos', cityA);
      assert.ok(list.html.includes('href="' + path + '"'));
      const own = await getPage(path, cityA);
      assert.equal(own.status, 200);
      assert.ok(own.html.includes(project.title));
      assert.ok(own.html.includes(cityA.name));
      assert.ok(own.html.includes(opportunityTitle));
      assert.ok(own.html.includes('FICTÍCIO / TESTE'));

      const forbidden = await getPage(path + '?municipality_id=' + cityA.id, cityB);
      assert.equal(forbidden.status, 404);
      assert.ok(!forbidden.html.includes(project.title));
      assert.equal((await getPage('/projetos/id-invalido', cityA)).status, 404);

      const anonymous = await getPage(path);
      assert.equal(anonymous.status, 307);
      assert.equal(anonymous.location, '/login');
      assert.ok(!anonymous.html.includes(project.title));
    });
  } finally {
    try {
      if (cities.length) {
        await db.query('DELETE FROM projects WHERE municipality_id = ANY($1::uuid[])', [cities]);
        await db.query('DELETE FROM users WHERE municipality_id = ANY($1::uuid[])', [cities]);
        await db.query('DELETE FROM municipalities WHERE id = ANY($1::uuid[])', [cities]);
      }
      if (opportunityId) await db.query('DELETE FROM opportunities WHERE id = $1', [opportunityId]);
    } finally {
      await db.end();
    }
  }
});
