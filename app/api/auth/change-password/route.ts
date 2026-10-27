import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, verifiedCookie, setSessionCookie } from '@/lib/auth';
import { query } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
export const runtime='nodejs';
const schema=z.object({
  currentPassword:z.string().min(1).max(512),
  newPassword:z.string().min(12).max(128)
    .regex(/[a-z]/,'Minúscula obrigatória')
    .regex(/[A-Z]/,'Maiúscula obrigatória')
    .regex(/[0-9]/,'Número obrigatório')
    .regex(/[^a-zA-Z0-9]/,'Símbolo obrigatório')
}).strict();
export async function POST(request:Request){
  const originBlock=rejectUntrustedWrite(request);if(originBlock)return originBlock;
  const user=await getSession(),ident=await verifiedCookie();
  if(!user||!ident||ident.userId!==user.id)
    return NextResponse.json({error:'Não autorizado'},{status:401});
  let body:unknown;try{body=await request.json();}catch{
    return NextResponse.json({error:'JSON inválido'},{status:400});
  }
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Senha nova inválida: mínimo 12 caracteres, incluindo letras, números e símbolo'},{status:400});
  try{
    const secret=process.env.SESSION_SECRET;
    if(!secret||secret.length<32)throw new Error('Configuração inválida');
    const bucket='acct:'+createHmac('sha256',secret).update('pwchange:'+user.id).digest('hex');
    const [limit]=await query<{allowed:boolean}>(
      'SELECT public.auth_consume_limit($1) AS allowed',[bucket]);
    if(!limit?.allowed)return NextResponse.json({error:'Muitas tentativas'},{status:429,headers:{'Retry-After':'900'}});
    const [row]=await query<{sid:string|null}>(
      'SELECT public.auth_change_password($1::uuid,$2::uuid,$3::text,$4::text) AS sid',
      [user.id,ident.sessionId,parsed.data.currentPassword,parsed.data.newPassword]);
    if(!row?.sid)return NextResponse.json({error:'Senha atual inválida, reutilizada ou sessão expirada'},{status:401});
    await setSessionCookie(user.id,row.sid);
    return NextResponse.json({ok:true,sessionsRevoked:true},{headers:{'Cache-Control':'no-store'}});
  }catch{
    return NextResponse.json({error:'Não foi possível atualizar a senha'},{status:503});
  }
}
