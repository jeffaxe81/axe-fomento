import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { ASSESS_REQUIREMENT_SQL } from '@/lib/requirement-assessment-sql.mjs';

export const runtime = 'nodejs';
const schema = z.object({
  projectId: z.string().uuid(),
  requirementId: z.string().uuid(),
  status: z.enum(['atendido','nao_atendido','pendente']),
  evidenceNote: z.string().trim().max(1000),
}).strict().superRefine((value, ctx) => {
  if (value.status !== 'pendente' && value.evidenceNote.length < 10) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['evidenceNote'],
      message: 'Informe a evidência ou justificativa da conclusão.' });
  }
});
export async function PUT(request: Request) {
  const blocked = rejectUntrustedWrite(request);
  if (blocked) return blocked;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Diagnóstico inválido ou sem evidência' }, { status: 400 });
  const d = parsed.data;
  const [result] = await queryForMunicipality<{ applicable: boolean; changed: boolean }>(
    user.municipality_id, ASSESS_REQUIREMENT_SQL,
    [user.municipality_id,d.projectId,d.requirementId,d.status,d.evidenceNote,user.id],user.id,
  );
  if (!result.applicable)
    return NextResponse.json({ error: 'Projeto ou requisito indisponível' }, { status: 404 });
  return NextResponse.json({ ok: true, changed: result.changed });
}
