/** Maintenance CLI: admin-only, safe to run daily on the ephemeral setup service. */
import pg from 'pg';
if(!process.env.DATABASE_ADMIN_URL) throw new Error('DATABASE_ADMIN_URL obrigatório; nunca execute no container web');
const db=new pg.Client({connectionString:process.env.DATABASE_ADMIN_URL});
await db.connect();
try {
  await db.query('BEGIN');
  const sessions=await db.query("DELETE FROM public.user_sessions WHERE expires_at < now() - interval '7 days'");
  const attempts=await db.query("DELETE FROM public.auth_rate_limits WHERE window_end < now() - interval '2 days'");
  await db.query('COMMIT');
  console.log(JSON.stringify({sessionsRemoved:sessions.rowCount,oldRateLimitBucketsRemoved:attempts.rowCount}));
} catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
