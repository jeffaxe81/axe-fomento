import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.DATABASE_ADMIN_URL)
 throw new Error('Teste de baseline exige PostgreSQL descartável.');
const run=promisify(execFile);

test('Banco legado sem ledger falha fechado; baseline revisado habilita upgrade seguro e repetível',async()=>{
  const admin=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
  const name='fomento_legacy_'+randomUUID().replace(/-/g,'').slice(0,12);
  const url=new URL(process.env.DATABASE_ADMIN_URL);url.pathname='/'+name;
  await admin.connect();
  let created=false;
  try{
    await admin.query('CREATE DATABASE '+name);created=true;
    const legacy=new pg.Client({connectionString:url.toString()});
    await legacy.connect();
    try{
      for(const f of ['001_initial.sql','002_tenant_rls.sql','003_auth_sessions_audit.sql','004_mfa_session_controls.sql']){
        await legacy.query(await readFile(new URL('../../sql/'+f,import.meta.url),'utf8'));
      }
    }finally{await legacy.end();}
    const env={...process.env,DATABASE_ADMIN_URL:url.toString()};
    await assert.rejects(run(process.execPath,['scripts/migrate.mjs'],{env}),/Banco legado sem hist.rico/);
    await assert.rejects(run(process.execPath,['scripts/baseline-migrations.mjs'],{
      env:{...env,MIGRATION_BASELINE_THROUGH:'4',MIGRATION_BASELINE_CONFIRM:'WRONG'}
    }),/I_VERIFIED_LEGACY_SCHEMA/);
    const baseline=await run(process.execPath,['scripts/baseline-migrations.mjs'],{
      env:{...env,MIGRATION_BASELINE_THROUGH:'4',MIGRATION_BASELINE_CONFIRM:'I_VERIFIED_LEGACY_SCHEMA'}
    });
    assert.match(baseline.stdout,/4 migrações/);
    const once=await run(process.execPath,['scripts/migrate.mjs'],{env});
    assert.match(once.stdout,/005_password_recovery.sql/);
    const twice=await run(process.execPath,['scripts/migrate.mjs'],{env});
    assert.match(twice.stdout,/Migração já aplicada/);
    const check=new pg.Client({connectionString:url.toString()});
    await check.connect();
    try{
      const count=(await check.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n;
      assert.equal(count,5);
      assert.equal((await check.query(
        "SELECT to_regprocedure('public.auth_change_password(uuid,uuid,text,text)') IS NOT NULL AS ok"
      )).rows[0].ok,true);
    }finally{await check.end();}
  }finally{
    if(created)await admin.query('DROP DATABASE '+name+' WITH (FORCE)');
    await admin.end();
  }
});
