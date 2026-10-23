import 'server-only';
import { Pool, type QueryResultRow } from 'pg';

const globalPool = globalThis as typeof globalThis & { __fomentoPool?: Pool };
function getPool(): Pool {
  // A conexão só é inicializada em tempo de execução, nunca durante o build.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida');
  if (!globalPool.__fomentoPool) globalPool.__fomentoPool = new Pool({ connectionString: url, max: 10 });
  return globalPool.__fomentoPool;
}

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
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
