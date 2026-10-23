import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL && !(process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE)) throw new Error('Configure DATABASE_URL ou PGHOST/PGUSER/PGPASSWORD/PGDATABASE do papel de migração');
const client = new pg.Client(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {});
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename text PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(new URL('../sql/', import.meta.url))).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
  for (const file of files) {
    await client.query('BEGIN');
    try {
      const installed = await client.query('SELECT 1 FROM public.schema_migrations WHERE filename=$1', [file]);
      if (!installed.rowCount) {
        await client.query((await readFile(new URL(`../sql/${file}`, import.meta.url))).toString());
        await client.query('INSERT INTO public.schema_migrations(filename) VALUES ($1)', [file]);
        console.log(`Migração aplicada: ${file}`);
      } else {
        console.log(`Migração já aplicada: ${file}`);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.end();
}
