import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';

export const runtime = 'nodejs';
const payload = z.object({ opportunityId: z.string().uuid() }).strict();

async function processRequest(request: Request, action: 'save' | 'remove') {
  const blocked = rejectUntrustedWrite(request);
  if (blocked) return blocked;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const parsed = payload.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Oportunidade inválida' }, { status: 400 });
  const id = parsed.data.opportunityId;
  if (action === 'remove') {
    await queryForMunicipality(user.municipality_id,
      'DELETE FROM opportunity_favorites WHERE municipality_id=$1 AND user_id=$2 AND opportunity_id=$3',
      [user.municipality_id, user.id, id], user.id);
    return NextResponse.json({ saved: false });
  }
  const [result] = await queryForMunicipality<{ available: boolean }>(
    user.municipality_id,
    'WITH available AS (SELECT id FROM opportunities WHERE id=$3::uuid), ' +
    'stored AS (INSERT INTO opportunity_favorites(municipality_id,user_id,opportunity_id) ' +
    'SELECT $1::uuid,$2::uuid,id FROM available ON CONFLICT DO NOTHING RETURNING opportunity_id) ' +
    'SELECT EXISTS(SELECT 1 FROM available) AS available',
    [user.municipality_id, user.id, id], user.id,
  );
  if (!result.available) return NextResponse.json({ error: 'Oportunidade indisponível' }, { status: 404 });
  return NextResponse.json({ saved: true });
}
export async function POST(request: Request) { return processRequest(request, 'save'); }
export async function DELETE(request: Request) { return processRequest(request, 'remove'); }
