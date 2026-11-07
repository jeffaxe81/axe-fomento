import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';

export const runtime = 'nodejs';
const schema = z.object({
  opportunityId: z.string().uuid(),
  requirement: z.string().trim().min(10).max(500),
  mandatory: z.boolean(),
  sourceUrl: z.string().trim().url().max(600).refine((s) => s.startsWith('https://')),
  sourceVersion: z.string().trim().min(1).max(100),
  sourceSection: z.string().trim().min(1).max(120),
  evidenceExcerpt: z.string().trim().min(10).max(1200),
}).strict();

export async function POST(request: Request) {
  const blocked = rejectUntrustedWrite(request);
  if (blocked) return blocked;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados de requisito inválidos' }, { status: 400 });
  const d = parsed.data;
  const [row] = await queryForMunicipality<{ id: string }>(user.municipality_id,
    'INSERT INTO opportunity_requirements(municipality_id,opportunity_id,requirement,mandatory,' +
    'source_url,source_version,source_section,evidence_excerpt,created_by) ' +
    'SELECT $1,o.id,$3,$4,$5,$6,$7,$8,$9 FROM opportunities o WHERE o.id=$2::uuid RETURNING id',
    [user.municipality_id,d.opportunityId,d.requirement,d.mandatory,d.sourceUrl,d.sourceVersion,
      d.sourceSection,d.evidenceExcerpt,user.id], user.id);
  if (!row) return NextResponse.json({ error: 'Oportunidade não encontrada' }, { status: 404 });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
