import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';
import { rejectUntrustedWrite } from '@/lib/security';
export async function POST(request: Request) {
  const blocked = rejectUntrustedWrite(request);
  if (blocked) return blocked;
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
