import { readFile } from 'node:fs/promises';
import pg from 'pg';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Defina DATABASE_URL');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query((await readFile(new URL('../sql/001_initial.sql', import.meta.url)).toString());
  await client.query('COMMIT');
  console.log('Migração 001 aplicada');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally { await client.end(); }
