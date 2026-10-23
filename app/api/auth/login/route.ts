import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
export const runtime = 'nodejs';
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(512) });
export async function POST(request: Request) {
  try {
    const body = loginSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 400 });
    const [user] = await query<{ id: string; password_hash: string }>('SELECT id, password_hash FROM public.auth_lookup_credentials($1)', [body.data.email]);
    // Previne vazamento de existência da conta via diferença trivial de fluxo.
    const fallback = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO8F2gEqMqCrxU63lSu3JH8p2JQfLQKGS';
    const valid = await bcrypt.compare(body.data.password, user?.password_hash ?? fallback);
    if (!user || !valid) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    await setSessionCookie(user.id);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Não foi possível autenticar' }, { status: 500 }); }
}
