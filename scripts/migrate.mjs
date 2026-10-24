import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Schema migrations may NEVER run with fomento_app's web credentials.
const connectionString=process.env.DATABASE_ADMIN_URL;
if(!connectionString)throw new Error('Defina DATABASE_ADMIN_URL com credencial de migração');
const files=['001_initial.sql','002_tenant_rls.sql','003_auth_sessions_audit.sql',
  '004_mfa_session_controls.sql','005_password_recovery.sql'];
const client=new pg.Client({connectionString});
await client.connect();
try{
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('axe_fomento_migrations_v1'))");
  const [existing]=(await client.query(`SELECT to_regclass('public.schema_migrations') AS ledger,
    to_regclass('public.municipalities') AS municipalities`)).rows;
  if(!existing.ledger&&existing.municipalities)
    throw new Error('Banco legado sem histórico: validar schema e executar db:baseline explicitamente antes das próximas migrações.');
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version text PRIMARY KEY,
    checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'),
    applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
  )`);
  for(const name of files){
    const source=await readFile(new URL('../sql/'+name,import.meta.url),'utf8');
    const checksum=createHash('sha256').update(source).digest('hex');
    const [row]=(await client.query('SELECT checksum FROM public.schema_migrations WHERE version=$1',[name])).rows;
    if(row){
      if(row.checksum!==checksum)throw new Error('Migração histórica modificada: '+name+'. Não alterar SQL já aplicado.');
      console.log('Migração já aplicada: '+name);
      continue;
    }
    await client.query(source);
    await client.query('INSERT INTO public.schema_migrations(version,checksum) VALUES($1,$2)',[name,checksum]);
    console.log('Migração aplicada: '+name);
  }
  await client.query('COMMIT');
}catch(error){
  await client.query('ROLLBACK');
  throw error;
}finally{await client.end();}
