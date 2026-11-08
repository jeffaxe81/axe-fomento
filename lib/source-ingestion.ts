import 'server-only';
import { createHash } from 'node:crypto';
import { queryForMunicipality } from '@/lib/db';
import { extractPrograms, SOURCE_URL, type NormalizedProgram } from '@/lib/transferegov-normalize.mjs';
import { STAGE_PROGRAM_SQL } from '@/lib/source-stage-sql.mjs';

export const SOURCE_KEY = 'transferegov-parcerias-programa';
const MAX_BYTES = 1024 * 1024;

async function readLimited(response: Response) {
  if (!response.body) throw new Error('Fonte sem corpo de resposta');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Resposta da fonte excede 1 MB');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) { bytes.set(chunk,cursor); cursor+=chunk.byteLength; }
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}

export async function fetchOfficialPrograms(fetchImpl: typeof fetch = fetch): Promise<NormalizedProgram[]> {
  const url = new URL(SOURCE_URL);
  url.searchParams.set('limit','25');
  const response = await fetchImpl(url.toString(), {
    headers: { accept: 'application/json' },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Fonte oficial respondeu HTTP ' + response.status);
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('json'))
    throw new Error('Fonte não retornou JSON');
  const body = await readLimited(response);
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { throw new Error('JSON da fonte inválido'); }
  return extractPrograms(payload, 25);
}

export async function stageProgram(municipalityId: string, actorId: string, item: NormalizedProgram) {
  // A versão do registro muda apenas se um campo verificado mudar.
  const canonical = JSON.stringify([item.externalId,item.title,item.provider,item.sourceUrl]);
  const checksum = createHash('sha256').update(canonical).digest('hex');
  const [row] = await queryForMunicipality<{ version: number; new_version: boolean }>(
    municipalityId,
    STAGE_PROGRAM_SQL,
    [municipalityId,SOURCE_KEY,item.externalId,item.title,item.provider,item.sourceUrl,checksum],
    actorId,
  );
  return row;
}

export async function startSourceRun(municipalityId:string, actorId:string) {
  const [row] = await queryForMunicipality<{ id: string }>(municipalityId,
    'INSERT INTO source_ingestion_runs(municipality_id,actor_id) VALUES($1,$2) RETURNING id',
    [municipalityId,actorId], actorId);
  return row.id;
}
export async function finishSourceRun(
  municipalityId:string, actorId:string, runId:string,
  status:'success'|'error', found:number,changed:number,
) {
  await queryForMunicipality(municipalityId,
    'UPDATE source_ingestion_runs SET status=$4,found_count=$5,changed_count=$6,' +
    'error_summary=CASE WHEN $4=\'error\' THEN \'Falha na coleta ou validação da fonte\' ELSE NULL END,' +
    'finished_at=clock_timestamp() WHERE id=$3 AND municipality_id=$1 AND actor_id=$2',
    [municipalityId,actorId,runId,status,found,changed],actorId);
}
