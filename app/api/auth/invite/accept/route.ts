import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({
  code:z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  fullName:z.string().trim().min(3).max(120),
  password:z.string().min(12).max(128),
}).strict();

export async function POST(request:Request){
  const blocked=rejectUntrustedWrite(request);
  if(blocked)return blocked;
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
  const data=schema.safeParse(body);
  if(!data.success)return NextResponse.json({error:'Convite ou credenciais inválidos'},{status:400});
  const hash=createHash('sha256').update(data.data.code).digest('hex');
  const [result]=await query<{user_id:string|null}>(
    'SELECT public.auth_invite_accept($1,$2,$3) AS user_id',
    [hash,data.data.fullName,data.data.password]);
  if(!result?.user_id) return NextResponse.json({
    error:'Convite inválido, expirado ou já utilizado; ou senha fora dos requisitos.'
  },{status:400});
  return NextResponse.json({ok:true},{status:201,headers:{'cache-control':'no-store'}});
}
