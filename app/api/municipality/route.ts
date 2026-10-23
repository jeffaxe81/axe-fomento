import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
export const runtime = 'nodejs';
const schema = z.object({ ibgeCode: z.string().regex(/^\d{7}$/).nullable(), population: z.number().int().min(0).max(100000000).nullable(), priorityAreas: z.array(z.string().trim().min(2).max(50)).max(20) }).strict();
export async function PATCH(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados do perfil inválidos' }, { status: 400 });
  const { ibgeCode, population, priorityAreas } = parsed.data;
  await queryForMunicipality(user.municipality_id, 'UPDATE municipalities SET ibge_code=$2,population=$3,priority_areas=$4 WHERE id=$1', [user.municipality_id, ibgeCode, population, [...new Set(priorityAreas)]]);
  return NextResponse.json({ ok: true });
}
