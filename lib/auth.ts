import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';

const COOKIE = 'axes_fomento_session';
function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET requer 32 caracteres ou mais');
  return new TextEncoder().encode(secret);
}
export async function makeSession(userId: string) {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('8h').setIssuer('axes-fomento').sign(secretKey());
}
export async function setSessionCookie(userId: string) {
  const jwt = await makeSession(userId);
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60
  });
}
export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}
export type UserSession = { id: string; full_name: string; email: string; role: 'admin' | 'analyst'; municipality_id: string };
export async function getSession(): Promise<UserSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: 'axes-fomento', algorithms: ['HS256'] });
    if (!payload.sub) return null;
    const [user] = await query<UserSession>(
      'SELECT id, full_name, email, role, municipality_id FROM public.auth_session_user($1::uuid)', [payload.sub]
    );
    return user ?? null;
  } catch { return null; }
}
export async function requireSession(): Promise<UserSession> {
  const user = await getSession();
  if (!user) redirect('/login');
  return user;
}
