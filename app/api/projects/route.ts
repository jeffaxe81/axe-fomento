import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
export const runtime = 'nodejs';
const projectSchema = z.object({ title: z.string().trim().min(3).max(180), opportunityId: z.string().uuid() });
export async function POST(request: Request) {
  const blocked = rejectUntrustedWrite(request);
  if (blocked) return blocked;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  const rows = await query<{ id: string }>(
    'INSERT INTO projects (municipality_id, opportunity_id, title, owner_user_id) ' +
    'SELECT $1, o.id, $3, $4 FROM opportunities o WHERE o.id = $2 RETURNING id',
    [user.municipality_id, parsed.data.opportunityId, parsed.data.title, user.id]
  );
  if (!rows.length) return NextResponse.json({ error: 'Oportunidade não encontrada' }, { status: 404 });
  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
