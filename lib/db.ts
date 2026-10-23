import 'server-only';
import { Pool, type QueryResultRow } from 'pg';
const globalPool = globalThis as typeof globalThis & { __fomentoPool?: Pool };
function getPool(): Pool {
  // DATABASE_URL must point to fomento_app, never the migration account.
  const url=process.env.DATABASE_URL;
  if(!url) throw new Error('DATABASE_URL não definida');
  if(!globalPool.__fomentoPool) globalPool.__fomentoPool=new Pool({connectionString:url,max:10});
  return globalPool.__fomentoPool;
}
/** Reserved for global opportunities and privileged, narrowly-granted auth functions. */
export async function query<T extends QueryResultRow>(sql:string,params:unknown[]=[]):Promise<T[]> {
  return (await getPool().query<T>(sql,params)).rows;
}
/** Set tenant from a VERIFIED server session, scoped to one database transaction. */
export async function queryForMunicipality<T extends QueryResultRow>(
  municipalityId:string, sql:string, params:unknown[]=[]
):Promise<T[]> {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(municipalityId))
    throw new Error('Contexto municipal inválido');
  const client=await getPool().connect();
  let active=false;
  try {
    await client.query('BEGIN');active=true;
    await client.query("SELECT set_config('app.tenant_id',$1,true)",[municipalityId]);
    const result=await client.query<T>(sql,params);
    await client.query('COMMIT');active=false;
    return result.rows;
  } catch (error) {
    if(active) await client.query('ROLLBACK');
    throw error;
  } finally {client.release();}
}
export type Municipality={
  id:string;name:string;uf:string;ibge_code:string|null;population:number|null;priority_areas:string[];
};
export type Opportunity={
  id:string;title:string;provider:string;source_url:string|null;deadline:string|null;created_at:string;
  areas:string[];eligible_ufs:string[];min_population:number|null;max_population:number|null;funding_amount:string|null;
};
export type Project={
  id:string;title:string;status:string;created_at:string;opportunity_title:string|null;owner_name:string|null;
};
