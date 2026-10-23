import 'server-only';
import { Pool, type QueryResultRow } from 'pg';

const globalPool = globalThis as typeof globalThis & { __fomentoPool?: Pool };
function getPool(): Pool {
  // Separação mandatória entre papel administrativo e o papel web.
  // DATABASE_URL é exclusivo dos scripts de migração/gestão, nunca do Next.js.
  if (process.env.DATABASE_URL) throw new Error('DATABASE_URL administrativa não pode estar presente no processo web');
  if (process.env.PGUSER !== 'fomento_app') throw new Error('O web deve conectar como fomento_app (sem privilégios administrativos)');
  if (!(process.env.PGHOST && process.env.PGDATABASE && process.env.PGPASSWORD)) {
    throw new Error('Configure PGHOST/PGDATABASE/PGUSER/PGPASSWORD para o web');
  }
  if (!globalPool.__fomentoPool) {
    globalPool.__fomentoPool = new Pool({
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: Number(process.env.PGPORT || '5432'),
      max: 10,
    });
  }
  return globalPool.__fomentoPool;
}

/** Somente para oportunidades públicas e funções restritas de autenticação. */
export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

/** Garante que o RLS vale na MESMA conexão e transação da consulta. */
export async function queryForMunicipality<T extends QueryResultRow>(municipalityId: string, sql: string, params: unknown[] = []): Promise<T[]> {
  if (!/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(municipalityId)) {
    throw new Error('Identificador de município inválido');
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.municipality_id', $1, true)", [municipalityId]);
    const result = await client.query<T>(sql, params);
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type Municipality = {
  id: string; name: string; uf: string; ibge_code: string | null; population: number | null; priority_areas: string[];
};
export type Opportunity = {
  id: string; title: string; provider: string; source_url: string | null; deadline: string | null; created_at: string;
  areas: string[]; eligible_ufs: string[]; min_population: number | null; max_population: number | null; funding_amount: string | null;
};
export type Project = {
  id: string; title: string; status: string; created_at: string; opportunity_title: string | null; owner_name: string | null;
};
