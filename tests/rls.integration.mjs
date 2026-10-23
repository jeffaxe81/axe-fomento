/** Integração PostgreSQL 17: exige RLS_TEST_ADMIN_URL e RLS_TEST_APP_URL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const adminUrl = process.env.RLS_TEST_ADMIN_URL;
const appUrl = process.env.RLS_TEST_APP_URL;
if (!adminUrl || !appUrl) {
  throw new Error('Configure RLS_TEST_ADMIN_URL e RLS_TEST_APP_URL para executar testes de isolamento');
}

test('RLS bloqueia leitura/escrita entre prefeituras sem herança de contexto', async t => {
  const admin = new pg.Client({ connectionString: adminUrl });
  const app = new pg.Client({ connectionString: appUrl });
  const run = randomUUID();
  let a, b, aUser, bUser, opp;
  await admin.connect();
  await app.connect();
  try {
    const [role] = (await app.query(`SELECT current_user AS name, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname=current_user`)).rows;
    assert.equal(role.name, 'fomento_app');
    assert.equal(role.rolsuper, false);
    assert.equal(role.rolbypassrls, false);
    const [owner] = (await admin.query("SELECT pg_get_userbyid(relowner) AS name FROM pg_class WHERE oid='public.projects'::regclass")).rows;
    assert.notEqual(owner.name, role.name, 'Usuário da aplicação não pode ser dono das tabelas');

    a = (await admin.query('INSERT INTO municipalities(name,uf) VALUES ($1,$2) RETURNING id', [`A ${run}`, 'SC'])).rows[0].id;
    b = (await admin.query('INSERT INTO municipalities(name,uf) VALUES ($1,$2) RETURNING id', [`B ${run}`, 'PR'])).rows[0].id;
    aUser = (await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id', [a, 'Gestora A', `a-${run}@example.test`, 'hash-teste'])).rows[0].id;
    bUser = (await admin.query('INSERT INTO users(municipality_id,full_name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id', [b, 'Gestor B', `b-${run}@example.test`, 'hash-teste'])).rows[0].id;
    opp = (await admin.query('INSERT INTO opportunities(title,provider,is_example) VALUES($1,$2,true) RETURNING id', [`Teste ${run}`,'Teste RLS'])).rows[0].id;
    await admin.query('INSERT INTO projects(municipality_id,opportunity_id,title,owner_user_id) VALUES ($1,$2,$3,$4),($5,$2,$6,$7)', [a,opp,'A project',aUser,b,'B project',bUser]);

    await t.test('sem contexto: RLS nega todos os dados privados', async () => {
      for (const tab of ['municipalities', 'projects', 'users']) {
        const r = await app.query(`SELECT count(*)::int AS total FROM public.${tab}`);
        assert.equal(r.rows[0].total, 0, tab);
      }
      assert.equal((await app.query('SELECT count(*)::int AS total FROM opportunities WHERE id=$1', [opp])).rows[0].total, 1);
    });

    await t.test('tenant A só enxerga dados A mesmo consultando IDs do B', async () => {
      await app.query('BEGIN');
      try {
        await app.query("SELECT set_config('app.municipality_id',$1,true)", [a]);
        assert.deepEqual((await app.query('SELECT id FROM municipalities WHERE id IN ($1,$2)', [a,b])).rows.map(r=>r.id), [a]);
        assert.equal((await app.query('SELECT count(*)::int AS total FROM projects')).rows[0].total, 1);
        assert.equal((await app.query('SELECT count(*)::int AS total FROM projects WHERE municipality_id=$1', [b])).rows[0].total, 0);
        assert.equal((await app.query('SELECT count(*)::int AS total FROM users WHERE id=$1', [bUser])).rows[0].total, 0);
        assert.equal((await app.query('UPDATE municipalities SET population=100 WHERE id=$1 RETURNING id', [b])).rowCount, 0);
        assert.equal((await app.query('DELETE FROM projects WHERE municipality_id=$1 RETURNING id', [b])).rowCount, 0);
      } finally { await app.query('COMMIT'); }
      // O mesmo socket/pool não pode manter contexto após COMMIT.
      assert.equal((await app.query('SELECT count(*)::int AS total FROM projects')).rows[0].total, 0);
    });

    await t.test('tenant A não pode inserir projeto do tenant B', async () => {
      await app.query('BEGIN');
      try {
        await app.query("SELECT set_config('app.municipality_id',$1,true)", [a]);
        await assert.rejects(() => app.query('INSERT INTO projects(municipality_id,title) VALUES ($1,$2)', [b,'Tentativa indevida']), e => e.code === '42501');
      } finally { await app.query('ROLLBACK'); }
    });

    await t.test('tenant B acessa somente B e consegue criar seu projeto', async () => {
      await app.query('BEGIN');
      try {
        await app.query("SELECT set_config('app.municipality_id',$1,true)", [b]);
        assert.equal((await app.query('SELECT count(*)::int AS total FROM projects')).rows[0].total, 1);
        assert.equal((await app.query('SELECT count(*)::int AS total FROM projects WHERE municipality_id=$1', [a])).rows[0].total, 0);
        const newOne = await app.query('INSERT INTO projects(municipality_id,title,owner_user_id) VALUES($1,$2,$3) RETURNING id', [b,'Novo projeto B',bUser]);
        assert.equal(newOne.rowCount, 1);
      } finally { await app.query('ROLLBACK'); }
    });

    await t.test('autenticação pode resolver sessão, mas não ler hashes em SQL direto', async () => {
      await assert.rejects(() => app.query('SELECT password_hash FROM users LIMIT 1'), e=> e.code === '42501');
      assert.equal((await app.query('SELECT id FROM public.auth_resolve_session($1::uuid)', [aUser])).rows[0].id, aUser);
      assert.equal((await app.query('SELECT id FROM public.auth_lookup_credentials($1)', [`b-${run}@example.test`])).rows[0].id, bUser);
    });
  } finally {
    if (a || b) {
      await admin.query('DELETE FROM projects WHERE municipality_id = ANY($1::uuid[])', [[a,b].filter(Boolean)]);
      await admin.query('DELETE FROM users WHERE municipality_id = ANY($1::uuid[])', [[a,b].filter(Boolean)]);
      await admin.query('DELETE FROM municipalities WHERE id = ANY($1::uuid[])', [[a,b].filter(Boolean)]);
    }
    if (opp) await admin.query('DELETE FROM opportunities WHERE id=$1', [opp]);
    await app.end();
    await admin.end();
  }
});
