import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, type UserSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';

export const runtime = 'nodejs';
const fields = z.object({
  name: z.string().trim().min(2).max(60),
  search: z.string().trim().max(120),
  area: z.string().trim().max(60),
}).strict();
const update = fields.extend({ id: z.string().uuid() });
const removal = z.object({ id: z.string().uuid() }).strict();
type Saved = { id: string; name: string; search: string; area: string };

async function context(request: Request) {
  const blocked = rejectUntrustedWrite(request);
  if (blocked) return { response: blocked };
  const user = await getSession();
  if (!user) return { response: NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 }) };
  let body: unknown;
  try { body = await request.json(); }
  catch { return { response: NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }; }
  return { user, body };
}
function duplicate(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
function values(user: UserSession, data: z.infer<typeof fields>) {
  return [user.municipality_id, user.id, data.name, data.search, data.area];
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if (ctx.response) return ctx.response;
  const parsed = fields.safeParse(ctx.body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados da busca inválidos' }, { status: 400 });
  const user = ctx.user!;
  const [item] = await queryForMunicipality<Saved>(user.municipality_id,
    'INSERT INTO saved_opportunity_searches(municipality_id,user_id,name,search_text,area) ' +
    'VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING ' +
    'RETURNING id,name,search_text AS search,area',
    values(user, parsed.data), user.id);
  if (!item) return NextResponse.json({ error: 'Já existe uma busca com este nome' }, { status: 409 });
  return NextResponse.json({ item }, { status: 201 });
}
export async function PATCH(request: Request) {
  const ctx = await context(request);
  if (ctx.response) return ctx.response;
  const parsed = update.safeParse(ctx.body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados da busca inválidos' }, { status: 400 });
  const user = ctx.user!;
  try {
    const [item] = await queryForMunicipality<Saved>(user.municipality_id,
      'UPDATE saved_opportunity_searches SET name=$4,search_text=$5,area=$6,updated_at=clock_timestamp() ' +
      'WHERE id=$3 AND municipality_id=$1 AND user_id=$2 ' +
      'RETURNING id,name,search_text AS search,area',
      [user.municipality_id, user.id, parsed.data.id, parsed.data.name, parsed.data.search, parsed.data.area], user.id);
    if (!item) return NextResponse.json({ error: 'Busca não encontrada' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (duplicate(error)) return NextResponse.json({ error: 'Já existe uma busca com este nome' }, { status: 409 });
    throw error;
  }
}
export async function DELETE(request: Request) {
  const ctx = await context(request);
  if (ctx.response) return ctx.response;
  const parsed = removal.safeParse(ctx.body);
  if (!parsed.success) return NextResponse.json({ error: 'Busca inválida' }, { status: 400 });
  const user = ctx.user!;
  const removed = await queryForMunicipality<{ id: string }>(user.municipality_id,
    'DELETE FROM saved_opportunity_searches WHERE id=$3 AND municipality_id=$1 AND user_id=$2 RETURNING id',
    [user.municipality_id, user.id, parsed.data.id], user.id);
  if (!removed.length) return NextResponse.json({ error: 'Busca não encontrada' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
