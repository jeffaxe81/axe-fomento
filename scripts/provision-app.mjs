/** Executar SOMENTE com credenciais administrativas, fora do processo web. */
import pg from 'pg';
const { DATABASE_URL, APP_DB_PASSWORD } = process.env;
if (!DATABASE_URL && !(process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE)) throw new Error('Informe conexão administrativa com DATABASE_URL ou PG*');
if (!APP_DB_PASSWORD || APP_DB_PASSWORD.length < 24) throw new Error('APP_DB_PASSWORD deve ter pelo menos 24 caracteres');
const client = new pg.Client(DATABASE_URL ? { connectionString: DATABASE_URL } : {});
await client.connect();
try {
  await client.query('BEGIN');
  const [{ exists }] = (await client.query("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='fomento_app') AS exists")).rows;
  if (!exists) await client.query('CREATE ROLE fomento_app LOGIN');
  // PostgreSQL formata e escapa o segredo com %L; não interpolamos a senha em SQL.
  const [{ sql }] = (await client.query("SELECT format('ALTER ROLE fomento_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', $1) AS sql", [APP_DB_PASSWORD])).rows;
  await client.query(sql);
  await client.query('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM fomento_app');
  await client.query('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM fomento_app');
  await client.query('GRANT USAGE ON SCHEMA public TO fomento_app');
  await client.query('GRANT SELECT ON public.opportunities TO fomento_app');
  await client.query('GRANT SELECT, UPDATE (ibge_code, population, priority_areas) ON public.municipalities TO fomento_app');
  await client.query('GRANT SELECT (id, full_name, municipality_id) ON public.users TO fomento_app');
  await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO fomento_app');
  await client.query('GRANT EXECUTE ON FUNCTION public.auth_lookup_credentials(text) TO fomento_app');
  await client.query('GRANT EXECUTE ON FUNCTION public.auth_resolve_session(uuid) TO fomento_app');
  await client.query('COMMIT');
  console.log('Papel fomento_app provisionado sem acesso administrativo ou BYPASSRLS.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
