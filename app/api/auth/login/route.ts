import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { setSessionCookie, setPendingMfaCookie } from '@/lib/auth';
import { rejectUntrustedWrite } from '@/lib/security';
export const runtime = 'nodejs';
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(512) });
function bucket(kind: 'acct' | 'ip', value: string): string {
  const pepper = process.env.SESSION_SECRET;
  if (!pepper || pepper.length < 32) throw new Error('SESSION_SECRET inválido');
  return kind + ':' + createHmac('sha256', pepper).update(value).digest('hex');
}
async function allowed(key: string) {
  const [result] = await query<{ allowed: boolean }>('SELECT public.auth_consume_limit($1) AS allowed', [key]);
  return result?.allowed === true;
}
export async function POST(request: Request) {
  const blocked = rejectUntrustedWrite(request);
  if (blocked) return blocked;
  try {
    const body = loginSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 400 });
    // Account limiter is always active; source IP limiter requires a trusted proxy
    // that overwrites X-Real-IP and never forwards a client-provided value.
    const email = body.data.email.trim().toLowerCase();
    const accountAllowed = await allowed(bucket('acct', email));
    let ipAllowed = true;
    if (process.env.TRUST_PROXY_IP === 'true') {
      const source = request.headers.get('x-real-ip')?.trim() ?? '';
      if (isIP(source)) ipAllowed = await allowed(bucket('ip', source));
    }
    if (!accountAllowed || !ipAllowed) {
      return NextResponse.json({ error: 'Muitas tentativas. Tente novamente mais tarde.' },
        { status: 429, headers: { 'Retry-After': '900' } });
    }
    const [user] = await query<{ id: string; sid: string; mfa_required: boolean }>(
      'SELECT id, sid, mfa_required FROM public.auth_login($1,$2)', [email, body.data.password]
    );
    if (!user) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    if(user.mfa_required){
      await setPendingMfaCookie(user.id,user.sid);
      return NextResponse.json({mfaRequired:true},{status:202});
    }
    await setSessionCookie(user.id, user.sid);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível autenticar' }, { status: 500 });
  }
}
