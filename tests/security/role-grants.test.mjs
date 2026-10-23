import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

test('application role has no elevated PostgreSQL privileges', async (t) => {
  if (process.env.RUN_TEST_DB_ISOLATION !== 'yes') return t.skip('isolated test database required');
  assert.ok(process.env.DATABASE_ADMIN_URL, 'DATABASE_ADMIN_URL required');
  const db = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await db.connect();
  try {
    const result = await db.query("SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolinherit FROM pg_roles WHERE rolname = 'fomento_app'");
    assert.equal(result.rowCount, 1);
    const role = result.rows[0];
    assert.equal(role.rolsuper, false);
    assert.equal(role.rolcreatedb, false);
    assert.equal(role.rolcreaterole, false);
    assert.equal(role.rolbypassrls, false);
    assert.equal(role.rolinherit, false);
    const privileges = await db.query("SELECT has_table_privilege('fomento_app','public.users','INSERT') AS insert_users, has_table_privilege('fomento_app','public.users','DELETE') AS delete_users");
    assert.equal(privileges.rows[0].insert_users, false);
    assert.equal(privileges.rows[0].delete_users, false);
  } finally {
    await db.end();
  }
});
