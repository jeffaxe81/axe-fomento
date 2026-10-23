import { readFile } from 'node:fs/promises';
import pg from 'pg';

const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Defina DATABASE_URL');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  for (const name of ['001_initial.sql', '002_tenant_rls.sql', '003_auth_sessions_audit.sql']) {
    await client.query(await readFile(new URL('../sql/' + name, import.meta.url), 'utf8'));
    console.log('Migração aplicada: ' + name);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
