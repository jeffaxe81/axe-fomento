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
  const url = process.env.TEST_BASE_URL;
  const suffix = randomUUID();
  const cities = [], users = [], opportunities = [];
  const password = 'Somente-Teste-Favoritos-2026!';
  const hash = await bcrypt.hash(password, 10);

  async function login(email) {
    const response = await fetch(url + '/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: url },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    assert.match(cookie ?? '', /^axes_fomento_session=.+/);
    return cookie;
  }

  async function identity(cityIndex, label) {
    const city = cities[cityIndex];
    const email = 'favoritos-' + suffix + '-' + label + '@example.invalid';
    const { rows: [user] } = await admin.query(
      "INSERT INTO users(municipality_id,full_name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id",
      [city, 'Teste ' + label, email, hash],
    );
    users.push(user.id);
    return { id: user.id, city, email, cookie: await login(email) };
  }

  async function createOpportunity(title) {
    const { rows: [opportunity] } = await admin.query(
      "INSERT INTO opportunities(title,provider,is_example) VALUES($1,'Fonte fictícia',true) RETURNING id",
      [title],
    );
    opportunities.push(opportunity.id);
    return opportunity.id;
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

  async function withRlsContext(tenant, actor, check) {
    await restricted.query('BEGIN');
    try {
      if (tenant) await restricted.query("SELECT set_config('app.tenant_id',$1,true)", [tenant]);
      if (actor) await restricted.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
      await check();
    } finally {
      await restricted.query('ROLLBACK');
    }
  }

  function deniedByRls(table) {
    return {
      code: '42501',
      message: new RegExp('row-level security policy for table "' + table + '"', 'i'),
    };
  }

  try {
    await admin.connect();
    await restricted.connect();
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
    const opportunityId = await createOpportunity(title);

    await t.test('POSTs concorrentes gravam um único favorito, visível apenas ao dono', async () => {
      const body = { opportunityId };
      const writes = await Promise.all([
        change('/api/opportunities/favorites', 'POST', body, a),
        change('/api/opportunities/favorites', 'POST', body, a),
      ]);
      for (const write of writes) assert.deepEqual(write, { status: 200, json: { saved: true } });
      const { rows } = await admin.query(
        'SELECT municipality_id, user_id, opportunity_id FROM opportunity_favorites WHERE opportunity_id=$1',
        [opportunityId],
      );
      assert.deepEqual(rows, [{ municipality_id: a.city, user_id: a.id, opportunity_id: opportunityId }]);
      for (const [actor, visible] of [[a, true], [aOther, false], [b, false]]) {
        const favorites = await page('/oportunidades/favoritos', actor);
        assert.equal(favorites.status, 200);
        assert.equal(favorites.html.includes(title), visible);
      }
      assert.equal((await change('/api/opportunities/favorites', 'POST', { opportunityId: randomUUID() }, a)).status, 404);
      assert.equal((await change('/api/opportunities/favorites', 'POST', { opportunityId: 'x' }, a)).status, 400);
      assert.equal((await change('/api/opportunities/favorites', 'POST', body, undefined)).status, 401);
      assert.equal((await change('/api/opportunities/favorites', 'POST', body, a, 'https://exemplo-malicioso.invalid')).status, 403);
    });

    await t.test('criar, renomear, recuperar, validar e excluir busca própria', async () => {
      const query = { name: 'Saúde ' + suffix, search: suffix, area: 'saúde' };
      const renamed = 'Educação ' + suffix;
      const created = await change('/api/opportunities/searches', 'POST', query, a);
      assert.equal(created.status, 201);
      const searchId = created.json.item.id;
      assert.equal((await change('/api/opportunities/searches', 'POST', { ...query, name: query.name.toUpperCase() }, a)).status, 409);
      const radar = await page('/oportunidades', a);
      assert.equal(radar.status, 200);
      assert.ok(radar.html.includes(query.name));
      assert.ok(radar.html.includes('busca=' + suffix));
      for (const actor of [aOther, b]) {
        const otherRadar = await page('/oportunidades', actor);
        assert.equal(otherRadar.status, 200);
        assert.ok(!otherRadar.html.includes(query.name));
      }
      const editedFields = { id: searchId, name: renamed, search: 'educacao-' + suffix, area: 'educação' };
      const edited = await change('/api/opportunities/searches', 'PATCH',
        editedFields, a);
      assert.equal(edited.status, 200);
      assert.deepEqual(edited.json.item, editedFields);
      assert.equal((await change('/api/opportunities/searches', 'PATCH',
        { id: searchId, name: 'Ataque', search: '', area: '' }, b)).status, 404);
      assert.equal((await change('/api/opportunities/searches', 'DELETE', { id: searchId }, aOther)).status, 404);
      assert.equal((await change('/api/opportunities/searches', 'POST',
        { name: '', search: '', area: '' }, a)).status, 400);

      const oldCookie = a.cookie;
      const logout = await fetch(url + '/api/auth/logout', {
        method: 'POST', headers: { cookie: oldCookie, origin: url }, redirect: 'manual',
      });
      assert.equal(logout.status, 303);
      assert.equal((await page('/oportunidades', { cookie: oldCookie })).status, 307);
      a.cookie = await login(a.email);
      assert.notEqual(a.cookie, oldCookie);

      const afterLogin = await page('/oportunidades', a);
      assert.equal(afterLogin.status, 200);
      assert.ok(afterLogin.html.includes(renamed));
      assert.ok(afterLogin.html.includes('busca=' + editedFields.search));
      assert.ok(!afterLogin.html.includes(query.name));
      const favorites = await page('/oportunidades/favoritos', a);
      assert.equal(favorites.status, 200);
      assert.ok(favorites.html.includes(title));

      assert.equal((await change('/api/opportunities/searches', 'DELETE', { id: searchId }, a)).status, 200);
      const afterDelete = await page('/oportunidades', a);
      assert.equal(afterDelete.status, 200);
      assert.ok(!afterDelete.html.includes(renamed));
    });

    const probeOpportunityId = await createOpportunity('Oportunidade RLS ' + suffix);
    const { rows: [{ id: savedProbeId }] } = await admin.query(
      'INSERT INTO saved_opportunity_searches(municipality_id,user_id,name) VALUES($1,$2,$3) RETURNING id',
      [a.city, a.id, 'Busca RLS visível ' + suffix],
    );
    const probes = [
      {
        table: 'opportunity_favorites',
        insert: 'INSERT INTO opportunity_favorites(municipality_id,user_id,opportunity_id) VALUES($1,$2,$3)',
        values: [a.city, a.id, probeOpportunityId],
        where: 'user_id=$1 AND opportunity_id=$2',
        existing: [a.id, opportunityId],
      },
      {
        table: 'saved_opportunity_searches',
        insert: 'INSERT INTO saved_opportunity_searches(municipality_id,user_id,name) VALUES($1,$2,$3)',
        values: [a.city, a.id, 'Busca RLS nova ' + suffix],
        where: 'user_id=$1 AND id=$2',
        existing: [a.id, savedProbeId],
      },
    ];
    const rejectedContexts = [
      ['ator errado no mesmo município', a.city, aOther.id],
      ['tenant errado com o ator do dono', b.city, a.id],
      ['tenant ausente com o ator do dono', undefined, a.id],
    ];
    for (const { table, insert, values, where, existing } of probes) {
      await t.test(table + ': USING só permite acesso à linha pelo dono no município correto', async () => {
        await withRlsContext(a.city, a.id, async () => {
          assert.equal((await restricted.query('SELECT 1 FROM ' + table + ' WHERE ' + where, existing)).rowCount, 1);
        });
        for (const [label, tenant, actor] of [...rejectedContexts, ['sem contexto', undefined, undefined]]) {
          await withRlsContext(tenant, actor, async () => {
            assert.equal((await restricted.query('SELECT 1 FROM ' + table + ' WHERE ' + where, existing)).rowCount, 0, label);
            assert.equal((await restricted.query('DELETE FROM ' + table + ' WHERE ' + where, existing)).rowCount, 0, label);
          });
        }
      });
      await t.test(table + ': WITH CHECK aceita a inserção com o contexto do dono', async () => {
        await withRlsContext(a.city, a.id, async () => {
          assert.equal((await restricted.query(insert, values)).rowCount, 1);
        });
      });
      for (const [label, tenant, actor] of rejectedContexts) {
        await t.test(table + ': WITH CHECK recusa ' + label, async () => {
          // A linha proposta sempre tem FK válida e não colide com as linhas existentes.
          await withRlsContext(tenant, actor, async () => {
            if (tenant === undefined) {
              const { rows: [{ tenant_id }] } = await restricted.query(
                "SELECT NULLIF(current_setting('app.tenant_id', true), '') AS tenant_id",
              );
              assert.equal(tenant_id, null);
            }
            await assert.rejects(restricted.query(insert, values), deniedByRls(table));
          });
        });
      }
    }

    await t.test('o dono pode remover o favorito; visitante é redirecionado', async () => {
      const removed = await change('/api/opportunities/favorites', 'DELETE', { opportunityId }, a);
      assert.equal(removed.status, 200);
      const favorites = await page('/oportunidades/favoritos', a);
      assert.equal(favorites.status, 200);
      assert.ok(!favorites.html.includes(title));
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
    } finally {
      await Promise.all([restricted.end(), admin.end()]);
    }
  }
});
