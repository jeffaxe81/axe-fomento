import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if (process.env.RUN_TEST_DB_ISOLATION !== 'yes' || !process.env.DATABASE_ADMIN_URL || !process.env.TEST_BASE_URL) {
  throw new Error('A suíte exige um banco descartável e o servidor de testes.');
}

test('Radar: pesquisa literal e paginação do catálogo', async (t) => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await db.connect();
  const base = process.env.TEST_BASE_URL;
  const prefix = 'Busca-' + randomUUID().slice(0, 8);
  const ids = [];
  let cityId;
  let cookie;

  async function add(title, provider, areas, createdAt) {
    const { rows: [opportunity] } = await db.query(
      'INSERT INTO opportunities(title, provider, areas, created_at, is_example) VALUES ($1,$2,$3,$4,true) RETURNING id',
      [title, provider, areas, createdAt],
    );
    ids.push(opportunity.id);
  }

  async function page(filters, path = '/oportunidades') {
    const response = await fetch(base + path + '?' + new URLSearchParams(filters), {
      headers: { cookie },
      redirect: 'manual',
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    // Read rendered headings only, excluding the repeated data in the Next.js payload.
    return { html, titles: [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map((match) => match[1]) };
  }

  try {
    const { rows: [city] } = await db.query(
      "INSERT INTO municipalities(name, uf) VALUES ($1, 'SC') RETURNING id", [prefix],
    );
    cityId = city.id;
    const email = prefix.toLowerCase() + '@example.invalid';
    const password = 'Somente-Teste-Busca-Radar-2026!';
    await db.query(
      'INSERT INTO users(municipality_id, full_name, email, password_hash) VALUES ($1,$2,$3,$4)',
      [cityId, 'Analista de teste', email, await bcrypt.hash(password, 10)],
    );
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    assert.ok(login.headers.get('set-cookie'));
    cookie = login.headers.get('set-cookie').split(';')[0];

    const old = prefix + ' AÇÃO 100%';
    const underscore = prefix + ' Inscrição';
    await add(old, 'Fonte de teste', ['SAÚDE pública'], '2000-01-01Z');
    await add(underscore, prefix + ' ÓRGÃO_A', ['Educação'], '2000-01-01Z');
    await add(prefix + ' AÇÃO 100X', 'Fonte de teste', ['Saúde'], '2000-01-01Z');
    await add(prefix + ' Sem separador literal', prefix + ' ÓRGÃOXA', ['Educação'], '2000-01-01Z');
    const { rows: newer } = await db.query(
      "INSERT INTO opportunities(title, provider, created_at, is_example) " +
      "SELECT $1 || ' preenchimento ' || n::text, 'Outra fonte', '2020-01-01Z', true " +
      'FROM generate_series(1, 110) AS n RETURNING id', [prefix],
    );
    ids.push(...newer.map(({ id }) => id));

    await t.test('encontra um título antigo além do antigo limite de 100, sem distinção de caixa acentuada', async () => {
      assert.deepEqual((await page({ busca: prefix + ' ação 100%', area: 'saúde' })).titles, [old]);
    });

    await t.test('trata % e _ como texto, combina órgão com área e remove NUL', async () => {
      assert.deepEqual((await page({ busca: prefix + ' AÇÃO 100%' })).titles, [old]);
      assert.deepEqual((await page({ busca: prefix + ' ó\0rgão_a', area: 'EDU\0CAÇÃO' })).titles, [underscore]);
      assert.deepEqual((await page({ busca: 'Inscrição ' + prefix + ' órgão_a' })).titles, [underscore]);
      const absent = await page({ busca: prefix + ' órgão_a', area: 'saúde' });
      assert.deepEqual(absent.titles, []);
      assert.ok(absent.html.includes('Nenhuma oportunidade corresponde aos filtros atuais.'));
    });

    await t.test('entrega 25 por página, desempata por id e mantém filtros ao voltar da comparação', async () => {
      const cohort = prefix + ' Paginação';
      const { rows: batch } = await db.query(
        "INSERT INTO opportunities(title, provider, areas, created_at, is_example) " +
        "SELECT $1 || ' ' || n::text, 'Fonte de teste', ARRAY['Saúde'], '2010-01-01Z', true " +
        'FROM generate_series(1, 27) AS n RETURNING id, title', [cohort],
      );
      ids.push(...batch.map(({ id }) => id));
      await add(cohort + ' área diferente', 'Fonte de teste', ['Educação'], '2021-01-01Z');
      const expected = batch.sort((a, b) => a.id < b.id ? 1 : -1);
      const filters = { busca: cohort, area: 'saúde' };
      const href = '/oportunidades?' + new URLSearchParams(filters).toString().replaceAll('&', '&amp;');
      const first = await page(filters);
      assert.deepEqual(first.titles, expected.slice(0, 25).map(({ title }) => title));
      assert.ok(first.html.includes('href="' + href + '&amp;pagina=2"'));
      const second = await page({ ...filters, pagina: '2' });
      assert.deepEqual(second.titles, expected.slice(25).map(({ title }) => title));
      assert.ok(second.html.includes('href="' + href + '"'));
      assert.ok(!second.html.includes('href="' + href + '&amp;pagina=3"'));
      assert.ok(second.html.includes('name="pagina" value="2"'));
      const comparison = await page([
        ...Object.entries(filters), ['pagina', '2'], ...expected.slice(25).map(({ id }) => ['id', id]),
      ], '/oportunidades/comparar');
      assert.ok(comparison.html.includes('href="' + href + '&amp;pagina=2"'));
    });
  } finally {
    try {
      if (ids.length) await db.query('DELETE FROM opportunities WHERE id = ANY($1::uuid[])', [ids]);
      if (cityId) {
        await db.query('DELETE FROM users WHERE municipality_id = $1', [cityId]);
        await db.query('DELETE FROM municipalities WHERE id = $1', [cityId]);
      }
    } finally {
      await db.end();
    }
  }
});
