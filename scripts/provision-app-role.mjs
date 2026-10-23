import pg from 'pg';
// Owner-only provisioning. NEVER expose DATABASE_ADMIN_URL to the web container.
const {DATABASE_ADMIN_URL, APP_DB_PASSWORD}=process.env;
if (!DATABASE_ADMIN_URL || !APP_DB_PASSWORD || APP_DB_PASSWORD.length < 24)
  throw new Error('Defina DATABASE_ADMIN_URL e APP_DB_PASSWORD (mínimo 24 caracteres).');
const db=new pg.Client({connectionString:DATABASE_ADMIN_URL});
await db.connect();
try {
  if (!(await db.query("SELECT 1 FROM pg_roles WHERE rolname='fomento_app'")).rowCount)
    await db.query('CREATE ROLE fomento_app LOGIN');
  const {rows:[{stmt}]}=await db.query(
    "SELECT format('ALTER ROLE fomento_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS PASSWORD %L',$1::text) AS stmt",
    [APP_DB_PASSWORD]);
  await db.query(stmt);
  await db.query('BEGIN');
  await db.query('GRANT USAGE ON SCHEMA public TO fomento_app');
  await db.query('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM fomento_app');
  await db.query('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM fomento_app');
  await db.query('GRANT SELECT ON public.opportunities TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON public.projects TO fomento_app');
  await db.query('GRANT SELECT, UPDATE (ibge_code,population,priority_areas) ON public.municipalities TO fomento_app');
  await db.query('GRANT SELECT(id,municipality_id,full_name,email,role,active) ON public.users TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_login(text,text) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_session_user(uuid,uuid) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_revoke_session(uuid,uuid) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_consume_limit(text) TO fomento_app');
  for (const signature of [
    'auth_mfa_begin(uuid,uuid,text)',
    'auth_mfa_pending_secret(uuid,uuid)',
    'auth_mfa_enable(uuid,uuid,bigint)',
    'auth_mfa_login_secret(uuid,uuid)',
    'auth_mfa_complete(uuid,uuid,bigint)',
    'auth_mfa_status(uuid,uuid)',
    'auth_list_sessions(uuid,uuid)',
    'auth_revoke_other_sessions(uuid,uuid)'
  ]) await db.query('GRANT EXECUTE ON FUNCTION public.' + signature + ' TO fomento_app');
  await db.query('COMMIT');
  console.log('Role fomento_app provisionada com acesso restrito e RLS.');
} catch(e){try {await db.query('ROLLBACK')} catch {} throw e;} finally {await db.end();}
