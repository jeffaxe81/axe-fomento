import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import { rejectUntrustedWrite } from '@/lib/security';
export const runtime = 'nodejs';
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(512) });
export async function POST(request: Request) {
  const blocked = rejectUntrustedWrite(request);
  if (blocked) return blocked;
  try {
    const body = loginSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 400 });
    const [user] = await query<{ id: string }>('SELECT id FROM public.auth_login($1,$2)', [body.data.email, body.data.password]);
    if (!user) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    await setSessionCookie(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível autenticar' }, { status: 500 });
  }
}
