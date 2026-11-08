import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Only for databases initialized with older releases before a migration ledger existed.
const {DATABASE_ADMIN_URL,MIGRATION_BASELINE_CONFIRM,MIGRATION_BASELINE_THROUGH}=process.env;
const names=['001_initial.sql','002_tenant_rls.sql','003_auth_sessions_audit.sql',
  '004_mfa_session_controls.sql','005_password_recovery.sql'];
const through=Number(MIGRATION_BASELINE_THROUGH);
if(!DATABASE_ADMIN_URL||MIGRATION_BASELINE_CONFIRM!=='I_VERIFIED_LEGACY_SCHEMA'
  ||!Number.isInteger(through)||through<1||through>5)
  throw new Error('Requer DATABASE_ADMIN_URL, MIGRATION_BASELINE_THROUGH=1..5 e MIGRATION_BASELINE_CONFIRM=I_VERIFIED_LEGACY_SCHEMA');
const db=new pg.Client({connectionString:DATABASE_ADMIN_URL});
await db.connect();
let transaction=false;
try{
  await db.query('BEGIN');transaction=true;
  await db.query("SELECT pg_advisory_xact_lock(hashtext('axe_fomento_migrations_v1'))");
  const [{ledger,municipalities}]=(await db.query(`SELECT to_regclass('public.schema_migrations') AS ledger,
    to_regclass('public.municipalities') AS municipalities`)).rows;
  if(ledger||!municipalities)throw new Error('Baseline permitido apenas para banco legado sem schema_migrations e com municipalities existentes.');
  const checks=[
    `SELECT to_regclass('public.municipalities') IS NOT NULL AND
      to_regclass('public.users') IS NOT NULL AND to_regclass('public.projects') IS NOT NULL AND
      to_regclass('public.opportunities') IS NOT NULL AS valid`,
    `SELECT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.projects')) AND
      (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.users')) AND
      (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.municipalities')) AND
      to_regprocedure('public.auth_login(text,text)') IS NOT NULL AS valid`,
    `SELECT to_regclass('public.user_sessions') IS NOT NULL AND
      to_regclass('public.auth_rate_limits') IS NOT NULL AND
      to_regclass('public.audit_events') IS NOT NULL AND
      to_regprocedure('public.auth_revoke_session(uuid,uuid)') IS NOT NULL AS valid`,
    `SELECT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='mfa_enabled') AND
      to_regprocedure('public.auth_mfa_status(uuid,uuid)') IS NOT NULL AS valid`,
    `SELECT to_regprocedure('public.auth_change_password(uuid,uuid,text,text)') IS NOT NULL
      AND EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='audit_events' AND column_name='metadata') AS valid`
  ];
  for(let i=0;i<through;i++){
    if(!(await db.query(checks[i])).rows[0]?.valid)
      throw new Error('Schema legado incompatível com migração '+names[i]+'; baseline abortado.');
  }
  if(through<names.length&&(await db.query(checks[through])).rows[0]?.valid)
    throw new Error('Schema contém sinais de migração posterior; selecione a versão real antes de criar baseline.');
  await db.query(`CREATE TABLE public.schema_migrations(
    version text PRIMARY KEY,checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'),
    applied_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
  for(let i=0;i<through;i++){
    const source=await readFile(new URL('../sql/'+names[i],import.meta.url),'utf8');
    const sha=createHash('sha256').update(source).digest('hex');
    await db.query('INSERT INTO public.schema_migrations(version,checksum) VALUES($1,$2)',[names[i],sha]);
  }
  await db.query('COMMIT');transaction=false;
  console.log('Baseline legado registrado e validado: '+through+' migrações. Agora execute db:migrate.');
}catch(e){if(transaction)await db.query('ROLLBACK');throw e;}finally{await db.end();}
