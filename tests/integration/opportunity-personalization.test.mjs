import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if (process.env.RUN_TEST_DB_ISOLATION !== 'yes' || !process.env.DATABASE_ADMIN_URL ||
    !process.env.DATABASE_URL || !process.env.TEST_BASE_URL) {
  throw new Error('Necessário servidor e banco de dados descartáveis.');
}

test('AF-007/008: favoritos e buscas salvas separados por usuário e prefeitura', async (t) => {
  const admin = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  const restricted = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await restricted.connect();
  const url = process.env.TEST_BASE_URL;
  const suffix = randomUUID().slice(0, 8);
  const cities = [], users = [], opportunities = [];
  const password = 'Somente-Teste-Favoritos-2026!';
  const hash = await bcrypt.hash(password, 10);

  async function identity(cityIndex, label) {
    const city = cities[cityIndex];
    const email = 'favoritos-' + suffix + '-' + label + '@example.invalid';
    const { rows: [user] } = await admin.query(
      "INSERT INTO users(municipality_id,full_name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id",
      [city, 'Teste ' + label, email, hash],
    );
    users.push(user.id);
    const login = await fetch(url + '/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    return { id: user.id, city, cookie: login.headers.get('set-cookie')?.split(';')[0] };
  }

  async function change(path, method, body, actor, origin = url) {
    const response = await fetch(url + path, {
      method, headers: {
        'content-type': 'application/json',
        ...(actor?.cookie ? { cookie: actor.cookie } : {}),
        origin,
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  }
  async function page(path, actor) {
    const response = await fetch(url + path, { headers: actor ? { cookie: actor.cookie } : {}, redirect: 'manual' });
    return { status: response.status, html: await response.text(), location: response.headers.get('location') };
  }

  try {
    for (const label of ['A', 'B']) {
      const { rows: [city] } = await admin.query(
        "INSERT INTO municipalities(name,uf) VALUES($1,'SC') RETURNING id",
        ['Personalizacao-' + suffix + label]);
      cities.push(city.id);
    }
    const a = await identity(0, 'a');
    const aOther = await identity(0, 'outro');
    const b = await identity(1, 'b');
    const title = 'Oportunidade personalizada ' + suffix;
    const { rows: [opportunity] } = await admin.query(
      "INSERT INTO opportunities(title,provider,is_example) VALUES($1,'Fonte fictícia',true) RETURNING id",
      [title]);
    opportunities.push(opportunity.id);

    await t.test('favoritos persistem após reload, são idempotentes e privados', async () => {
      const body = { opportunityId: opportunity.id };
      assert.equal((await change('/api/opportunities/favorites', 'POST', body, a)).status, 200);
      assert.equal((await change('/api/opportunities/favorites', 'POST', body, a)).status, 200);
      assert.equal((await admin.query('SELECT id FROM opportunity_favorites WHERE user_id=$1', [a.id])).rowCount, 1);
      assert.ok((await page('/oportunidades/favoritos', a)).html.includes(title));
      assert.ok(!(await page('/oportunidades/favoritos', aOther)).html.includes(title));
      assert.ok(!(await page('/oportunidades/favoritos', b)).html.includes(title));
      assert.equal((await change('/api/opportunities/favorites', 'POST', { opportunityId: randomUUID() }, a)).status, 404);
      assert.equal((await change('/api/opportunities/favorites', 'POST', { opportunityId: 'x' }, a)).status, 400);
      assert.equal((await change('/api/opportunities/favorites', 'POST', body, undefined)).status, 401);
      assert.equal((await change('/api/opportunities/favorites', 'POST', body, a, 'https://exemplo-malicioso.invalid')).status, 403);
    });

    let searchId;
    await t.test('criar, renomear, recuperar, validar e excluir busca própria', async () => {
      const query = { name: 'Saúde SC', search: suffix, area: 'saúde' };
      const created = await change('/api/opportunities/searches', 'POST', query, a);
      assert.equal(created.status, 201);
      searchId = created.json.item.id;
      assert.equal((await change('/api/opportunities/searches', 'POST', { ...query, name: 'SAÚDE SC' }, a)).status, 409);
      const radar = await page('/oportunidades', a);
      assert.ok(radar.html.includes('Saúde SC'));
      assert.ok(radar.html.includes('busca=' + suffix));
      assert.ok(!(await page('/oportunidades', aOther)).html.includes('Saúde SC'));
      assert.ok(!(await page('/oportunidades', b)).html.includes('Saúde SC'));
      const edited = await change('/api/opportunities/searches', 'PATCH',
        { id: searchId, name: 'Educação SC', search: 'educação', area: 'educação' }, a);
      assert.equal(edited.status, 200);
      assert.equal(edited.json.item.name, 'Educação SC');
      assert.ok((await page('/oportunidades', a)).html.includes('Educação SC'));
      assert.equal((await change('/api/opportunities/searches', 'PATCH',
        { id: searchId, name: 'Ataque', search: '', area: '' }, b)).status, 404);
      assert.equal((await change('/api/opportunities/searches', 'DELETE', { id: searchId }, aOther)).status, 404);
      assert.equal((await change('/api/opportunities/searches', 'POST',
        { name: '', search: '', area: '' }, a)).status, 400);
      assert.equal((await change('/api/opportunities/searches', 'DELETE', { id: searchId }, a)).status, 200);
      assert.ok(!(await page('/oportunidades', a)).html.includes('Educação SC'));
    });

    await t.test('RLS também nega dados sem contexto e a outro usuário do mesmo município', async () => {
      assert.equal((await restricted.query('SELECT * FROM opportunity_favorites')).rowCount, 0);
      assert.equal((await restricted.query('SELECT * FROM saved_opportunity_searches')).rowCount, 0);
      await restricted.query('BEGIN');
      try {
        await restricted.query("SELECT set_config('app.tenant_id',$1,true)", [a.city]);
        await restricted.query("SELECT set_config('app.actor_id',$1,true)", [aOther.id]);
        assert.equal((await restricted.query('SELECT * FROM opportunity_favorites')).rowCount, 0);
        assert.equal((await restricted.query(
          'DELETE FROM opportunity_favorites WHERE user_id=$1 RETURNING opportunity_id', [a.id])).rowCount, 0);
        await restricted.query('SAVEPOINT bad_favorite');
        await assert.rejects(restricted.query(
          'INSERT INTO opportunity_favorites(municipality_id,user_id,opportunity_id) VALUES($1,$2,$3)',
          [a.city, a.id, opportunity.id]), /row-level security/i);
        await restricted.query('ROLLBACK TO SAVEPOINT bad_favorite');
      } finally { await restricted.query('ROLLBACK'); }
      assert.equal((await restricted.query('SELECT * FROM opportunity_favorites')).rowCount, 0);
      const removed = await change('/api/opportunities/favorites', 'DELETE', { opportunityId: opportunity.id }, a);
      assert.equal(removed.status, 200);
      assert.ok(!(await page('/oportunidades/favoritos', a)).html.includes(title));
      assert.equal((await page('/oportunidades/favoritos')).status, 307);
    });
  } finally {
    try {
      if (users.length) {
        await admin.query('DELETE FROM opportunity_favorites WHERE user_id=ANY($1::uuid[])', [users]);
        await admin.query('DELETE FROM saved_opportunity_searches WHERE user_id=ANY($1::uuid[])', [users]);
        await admin.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
      }
      if (cities.length) await admin.query('DELETE FROM municipalities WHERE id=ANY($1::uuid[])', [cities]);
      if (opportunities.length) await admin.query('DELETE FROM opportunities WHERE id=ANY($1::uuid[])', [opportunities]);
    } finally { await restricted.end(); await admin.end(); }
  }
});
