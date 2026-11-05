import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, verifiedCookie } from '@/lib/auth';
import { query } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({
  email:z.string().trim().email().max(254),
  role:z.enum(['admin','analyst']),
}).strict();

export async function POST(request:Request) {
  const blocked=rejectUntrustedWrite(request);
  if(blocked) return blocked;
  const user=await getSession();
  const sid=await verifiedCookie();
  if(!user||!sid) return NextResponse.json({error:'Acesso não autorizado'},{status:401});
  if(user.role!=='admin') return NextResponse.json({error:'Permissão insuficiente'},{status:403});
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
  const data=schema.safeParse(body);
  if(!data.success)return NextResponse.json({error:'Dados do convite inválidos'},{status:400});
  const email=data.data.email.toLowerCase();
  const token=randomBytes(32).toString('base64url');
  const tokenHash=createHash('sha256').update(token).digest('hex');
  const [issued]=await query<{invitation_id:string;expires_at:string}>(
    'SELECT invitation_id,expires_at FROM public.auth_admin_issue_invite($1,$2,$3,$4,$5)',
    [user.id,sid.sessionId,email,data.data.role,tokenHash]);
  if(!issued) return NextResponse.json({error:'Convite indisponível para este endereço'},{status:409});
  return NextResponse.json({code:token,expiresAt:issued.expires_at,registrationPath:'/convite'},
    {status:201,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
}
