import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, verifiedCookie } from '@/lib/auth';
import { query } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({userId:z.string().uuid(),active:z.boolean()}).strict();

export async function PATCH(request:Request){
  const blocked=rejectUntrustedWrite(request);
  if(blocked)return blocked;
  const user=await getSession();
  const sid=await verifiedCookie();
  if(!user||!sid)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
  if(user.role!=='admin')return NextResponse.json({error:'Permissão insuficiente'},{status:403});
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
  const data=schema.safeParse(body);
  if(!data.success)return NextResponse.json({error:'Alteração inválida'},{status:400});
  const [result]=await query<{result:string}>(
    'SELECT public.auth_admin_set_account_state($1,$2,$3,$4) AS result',
    [user.id,sid.sessionId,data.data.userId,data.data.active]);
  if(result?.result==='updated')return NextResponse.json({ok:true});
  if(result?.result==='unchanged')return NextResponse.json({ok:true,unchanged:true});
  if(result?.result==='self'||result?.result==='last_admin')
    return NextResponse.json({error:'Não é permitido desativar sua própria conta ou o último administrador ativo.'},{status:409});
  if(result?.result==='not_found')return NextResponse.json({error:'Conta não encontrada neste município'},{status:404});
  return NextResponse.json({error:'Operação não autorizada'},{status:403});
}
