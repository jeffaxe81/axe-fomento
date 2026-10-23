import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, verifiedCookie } from '@/lib/auth';
import { query } from '@/lib/db';
import { decryptTotpSecret, encryptTotpSecret, generateTotpSecret, otpauthUri, verifyTotp } from '@/lib/mfa';
import { rejectUntrustedWrite } from '@/lib/security';
export const runtime='nodejs';
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('begin')}).strict(),
  z.object({action:z.literal('confirm'),code:z.string().regex(/^\d{6}$/)}).strict()
]);
export async function POST(request:Request){
  const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
  const user=await getSession(),session=await verifiedCookie();
  if(!user||!session||session.userId!==user.id)return NextResponse.json({error:'Não autorizado'},{status:401});
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Dados inválidos'},{status:400});
  try{
    if(parsed.data.action==='begin'){
      const secret=generateTotpSecret(),cipher=encryptTotpSecret(secret);
      const [row]=await query<{ok:boolean}>(
        'SELECT public.auth_mfa_begin($1::uuid,$2::uuid,$3::text) AS ok',
        [user.id,session.sessionId,cipher]);
      if(!row?.ok)return NextResponse.json({error:'MFA já ativado ou sessão inválida'},{status:409});
      return NextResponse.json({secret,otpauth:otpauthUri(secret,user.email)},{
        headers:{'Cache-Control':'no-store'}
      });
    }
    const hashed=createHmac('sha256',process.env.SESSION_SECRET||'')
      .update('mfa-enroll:'+user.id).digest('hex');
    const [limit]=await query<{allowed:boolean}>(
      'SELECT public.auth_consume_limit($1) AS allowed',['acct:'+hashed]);
    if(!limit?.allowed)return NextResponse.json({error:'Muitas tentativas'},{status:429,headers:{'Retry-After':'900'}});
    const [pending]=await query<{cipher:string|null}>(
      'SELECT public.auth_mfa_pending_secret($1::uuid,$2::uuid) AS cipher',
      [user.id,session.sessionId]);
    if(!pending?.cipher)return NextResponse.json({error:'Inicie a configuração do MFA'},{status:409});
    const step=verifyTotp(decryptTotpSecret(pending.cipher),parsed.data.code);
    if(step===null)return NextResponse.json({error:'Código inválido'},{status:401});
    const [result]=await query<{ok:boolean}>(
      'SELECT public.auth_mfa_enable($1::uuid,$2::uuid,$3::bigint) AS ok',
      [user.id,session.sessionId,step]);
    if(!result?.ok)return NextResponse.json({error:'Não foi possível confirmar'},{status:409});
    return NextResponse.json({enabled:true},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Configuração MFA indisponível'},{status:503});}
}
