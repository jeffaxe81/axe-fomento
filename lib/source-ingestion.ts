import 'server-only';
import { createHash } from 'node:crypto';
import { queryForMunicipality } from '@/lib/db';
import { extractPrograms, SOURCE_URL, type NormalizedProgram } from '@/lib/transferegov-normalize.mjs';

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
    `WITH rec AS (
      INSERT INTO source_programs(municipality_id,source_key,external_id,title,provider,source_url,checksum)
      VALUES($1,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(municipality_id,source_key,external_id) DO UPDATE SET
        title=EXCLUDED.title,provider=EXCLUDED.provider,source_url=EXCLUDED.source_url,
        checksum=EXCLUDED.checksum,last_seen_at=clock_timestamp(),
        version=source_programs.version+CASE WHEN source_programs.checksum<>EXCLUDED.checksum THEN 1 ELSE 0 END,
        review_state=CASE WHEN source_programs.checksum<>EXCLUDED.checksum THEN 'pending' ELSE source_programs.review_state END,
        reviewed_at=CASE WHEN source_programs.checksum<>EXCLUDED.checksum THEN NULL ELSE source_programs.reviewed_at END,
        reviewer_id=CASE WHEN source_programs.checksum<>EXCLUDED.checksum THEN NULL ELSE source_programs.reviewer_id END
      RETURNING id,municipality_id,version,checksum,title,provider,source_url,external_id
    ), snapshot AS (
      INSERT INTO source_program_versions(program_id,municipality_id,version,checksum,snapshot)
      SELECT id,municipality_id,version,checksum,
        jsonb_build_object('external_id',external_id,'title',title,'provider',provider,'source_url',source_url)
      FROM rec ON CONFLICT DO NOTHING RETURNING program_id
    )
    SELECT rec.version, EXISTS(SELECT 1 FROM snapshot) AS new_version FROM rec`,
    [municipalityId,actorId,SOURCE_KEY,item.externalId,item.title,item.provider,item.sourceUrl,checksum],
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
