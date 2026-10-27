import { NextResponse } from 'next/server';
import { revokeCurrentSession } from '@/lib/auth';
import { rejectUntrustedWrite } from '@/lib/security';
export async function POST(request: Request) {
  const blocked = rejectUntrustedWrite(request);
  if (blocked) return blocked;
  try {
    await revokeCurrentSession();
    return NextResponse.redirect(new URL('/login', request.url), 303);
  } catch {
    // Never indicate that the database session was revoked if revocation failed.
    return NextResponse.json({ error: 'Não foi possível encerrar a sessão' }, { status: 503 });
  }
}
