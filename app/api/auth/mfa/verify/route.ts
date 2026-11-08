import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clearPendingMfaCookie, getPendingMfaIds, setSessionCookie } from '@/lib/auth';
import { query } from '@/lib/db';
import { decryptTotpSecret, verifyTotp } from '@/lib/mfa';
import { rejectUntrustedWrite } from '@/lib/security';
export const runtime='nodejs';
const schema=z.object({code:z.string().regex(/^\d{6}$/)}).strict();
export async function POST(request:Request){
  const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
  const pending=await getPendingMfaIds();
  if(!pending)return NextResponse.json({error:'Desafio expirado. Entre novamente.'},{status:401});
  let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Código inválido'},{status:400});
  try {
    const hashed=createHmac('sha256',process.env.SESSION_SECRET||'')
      .update('mfa-verify:'+pending.userId).digest('hex');
    const [limit]=await query<{allowed:boolean}>(
      'SELECT public.auth_consume_limit($1) AS allowed',['acct:'+hashed]);
    if(!limit?.allowed)return NextResponse.json({error:'Muitas tentativas'},{status:429,headers:{'Retry-After':'900'}});
    const [row]=await query<{cipher:string|null}>(
      'SELECT public.auth_mfa_login_secret($1::uuid,$2::uuid) AS cipher',
      [pending.userId,pending.sessionId]);
    if(!row?.cipher)return NextResponse.json({error:'Desafio indisponível. Entre novamente.'},{status:401});
    const step=verifyTotp(decryptTotpSecret(row.cipher),parsed.data.code);
    if(step===null)return NextResponse.json({error:'Código inválido'},{status:401});
    const [result]=await query<{ok:boolean}>(
      'SELECT public.auth_mfa_complete($1::uuid,$2::uuid,$3::bigint) AS ok',
      [pending.userId,pending.sessionId,step]);
    if(!result?.ok)return NextResponse.json({error:'Código já utilizado ou sessão expirada'},{status:401});
    await setSessionCookie(pending.userId,pending.sessionId);
    await clearPendingMfaCookie();
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Autenticação MFA indisponível'},{status:503});}
}
