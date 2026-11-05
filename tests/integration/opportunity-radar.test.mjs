import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if (process.env.RUN_TEST_DB_ISOLATION !== 'yes' || !process.env.DATABASE_ADMIN_URL || !process.env.TEST_BASE_URL) {
  throw new Error('A suíte exige um banco descartável e o servidor de testes.');
}

test('Radar: comparação de oportunidades e agenda de prazos', async (t) => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await db.connect();
  const base = process.env.TEST_BASE_URL;
  const suffix = randomUUID().slice(0, 8);
  const prefix = 'Radar-' + suffix;
  const opportunityIds = [];
  let cityId;
  let cookie;

  async function addOpportunity(label, days, details = {}) {
    const title = prefix + ' ' + label;
    const { rows: [opportunity] } = await db.query(
      'INSERT INTO opportunities(title, provider, deadline, funding_amount, areas, eligible_ufs, is_example) ' +
      "VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + $3::integer, $4, $5, $6, true) " +
      'RETURNING id',
      [title, details.provider ?? 'Fonte de teste', days, details.amount ?? null, details.areas ?? [], details.states ?? []],
    );
    opportunityIds.push(opportunity.id);
    return { id: opportunity.id, title };
  }

  async function getPage(path, authenticated = true) {
    const response = await fetch(base + path, {
      headers: authenticated ? { cookie } : {},
      redirect: 'manual',
    });
    return { status: response.status, html: await response.text(), location: response.headers.get('location') };
  }

  function comparisonPath(ids, filters = {}) {
    const query = new URLSearchParams(filters);
    for (const id of ids) query.append('id', id);
    return '/oportunidades/comparar?' + query.toString();
  }

  try {
    const password = 'Somente-Teste-Radar-2026!';
    const email = prefix.toLowerCase() + '@example.invalid';
    const { rows: [city] } = await db.query(
      "INSERT INTO municipalities(name, uf) VALUES ($1, 'SC') RETURNING id",
      [prefix],
    );
    cityId = city.id;
    await db.query(
      'INSERT INTO users(municipality_id, full_name, email, password_hash) VALUES ($1, $2, $3, $4)',
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

    const today = await addOpportunity('Encerra hoje', 0, {
      provider: 'Instituição de teste ' + suffix,
      amount: '1234567.89',
      areas: ['saúde', 'educação'],
      states: ['SC', 'PR'],
    });
    const unknown = await addOpportunity('Sem data cadastrada', null);
    const expired = await addOpportunity('Prazo anterior', -1);
    const seven = await addOpportunity('Limite de sete dias', 7, { amount: '99999999999999.99' });
    const eight = await addOpportunity('Oitavo dia', 8);
    const thirty = await addOpportunity('Limite de trinta dias', 30);
    const thirtyOne = await addOpportunity('Trigésimo primeiro dia', 31);
    const ninety = await addOpportunity('Limite de noventa dias', 90);
    const ninetyOne = await addOpportunity('Além de noventa dias', 91);

    await t.test('radar oferece seleção, agenda e distinção dos estados de prazo', async () => {
      const page = await getPage('/oportunidades?busca=' + prefix);
      assert.equal(page.status, 200);
      assert.ok(page.html.includes('action="/oportunidades/comparar"'));
      assert.ok(page.html.includes('form="radar-comparison"'));
      assert.ok(page.html.includes('value="' + today.id + '"'));
      assert.ok(page.html.includes('href="/oportunidades/agenda"'));
      assert.ok(page.html.includes('Vence hoje'));
      assert.ok(page.html.includes('Prazo encerrado'));
      assert.ok(page.html.includes('Prazo não informado'));
    });

    await t.test('comparação exibe as escolhas em ordem, com precisão e origem de teste', async () => {
      const page = await getPage(comparisonPath([unknown.id, today.id.toUpperCase(), seven.id], { busca: prefix, area: 'saúde' }));
      assert.equal(page.status, 200);
      assert.ok(page.html.includes(unknown.title));
      assert.ok(page.html.includes(today.title));
      assert.ok(page.html.includes(seven.title));
      assert.ok(page.html.indexOf(unknown.title) < page.html.indexOf(today.title));
      assert.ok(page.html.indexOf(today.title) < page.html.indexOf(seven.title));
      assert.ok(page.html.includes('Instituição de teste ' + suffix));
      assert.ok(page.html.includes('1.234.567,89'));
      assert.ok(page.html.includes('99.999.999.999.999,99'));
      assert.ok(page.html.includes('saúde, educação'));
      assert.ok(page.html.includes('SC, PR'));
      assert.ok(page.html.includes('Não informado'));
      assert.ok(page.html.includes('FICTÍCIO / TESTE'));
      assert.ok(page.html.includes('href="/oportunidades?busca=' + prefix + '&amp;area=sa%C3%BAde"'));
    });

    await t.test('seleções incompletas, repetidas ou indisponíveis exibem mensagem e saída', async () => {
      for (const ids of [
        [today.id],
        [today.id, today.id.toUpperCase()],
        [today.id, 'id-invalido'],
        [today.id, unknown.id, seven.id, eight.id],
      ]) {
        const page = await getPage(comparisonPath(ids));
        assert.equal(page.status, 200);
        assert.ok(page.html.includes('Selecione 2 ou 3 oportunidades diferentes.'));
        assert.ok(page.html.includes('href="/oportunidades"'));
        assert.ok(!page.html.includes(today.title));
      }
      const missing = await getPage(comparisonPath([today.id, randomUUID()]));
      assert.equal(missing.status, 200);
      assert.ok(missing.html.includes('Uma ou mais oportunidades estão indisponíveis.'));
      assert.ok(!missing.html.includes(today.title));
    });

    await t.test('agenda inclui hoje e o limite do período, com ordem cronológica', async () => {
      const short = await getPage('/oportunidades/agenda?dias=7');
      assert.equal(short.status, 200);
      assert.ok(short.html.includes(today.title));
      assert.ok(short.html.includes(seven.title));
      assert.ok(short.html.indexOf(today.title) < short.html.indexOf(seven.title));
      assert.ok(short.html.includes('FICTÍCIO / TESTE'));
      for (const omitted of [expired, unknown, eight]) assert.ok(!short.html.includes(omitted.title));

      const standard = await getPage('/oportunidades/agenda?dias=invalido');
      assert.equal(standard.status, 200);
      assert.ok(standard.html.includes(thirty.title));
      assert.ok(!standard.html.includes(thirtyOne.title));

      const long = await getPage('/oportunidades/agenda?dias=90');
      assert.equal(long.status, 200);
      assert.ok(long.html.includes(thirtyOne.title));
      assert.ok(long.html.includes(ninety.title));
      assert.ok(!long.html.includes(ninetyOne.title));
    });

    await t.test('agenda permite consultar prazos além da primeira página', async () => {
      const lastTitle = prefix + ' Paginação 26';
      const { rows } = await db.query(
        "INSERT INTO opportunities(title, provider, deadline, is_example) " +
        "SELECT $1::text || ' Paginação ' || lpad(n::text, 2, '0'), 'Fonte de teste', " +
        "(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date + 90, true FROM generate_series(1, 26) n RETURNING id",
        [prefix],
      );
      opportunityIds.push(...rows.map(({ id }) => id));
      const first = await getPage('/oportunidades/agenda?dias=90');
      assert.equal(first.status, 200);
      assert.ok(!first.html.includes(lastTitle));
      assert.ok(first.html.includes('href="/oportunidades/agenda?dias=90&amp;pagina=2"'));
      const second = await getPage('/oportunidades/agenda?dias=90&pagina=2');
      assert.equal(second.status, 200);
      assert.ok(second.html.includes(lastTitle));
    });

    await t.test('comparação e agenda exigem autenticação', async () => {
      for (const path of [comparisonPath([today.id, seven.id]), '/oportunidades/agenda']) {
        const page = await getPage(path, false);
        assert.equal(page.status, 307);
        assert.equal(page.location, '/login');
        assert.ok(!page.html.includes(today.title));
      }
    });
  } finally {
    try {
      if (opportunityIds.length) await db.query('DELETE FROM opportunities WHERE id = ANY($1::uuid[])', [opportunityIds]);
      if (cityId) {
        await db.query('DELETE FROM users WHERE municipality_id = $1', [cityId]);
        await db.query('DELETE FROM municipalities WHERE id = $1', [cityId]);
      }
    } finally {
      await db.end();
    }
  }
});
