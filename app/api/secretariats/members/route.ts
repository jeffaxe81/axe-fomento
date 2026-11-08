import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { GRANT_SECRETARIAT_MEMBER_SQL,REVOKE_SECRETARIAT_MEMBER_SQL }
 from '@/lib/municipal-task-sql.mjs';
export const runtime='nodejs';
const schema=z.object({secretariatId:z.string().uuid(),userId:z.string().uuid()}).strict();
async function modify(request:Request,operation:'grant'|'revoke'){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Permissão insuficiente'},{status:403});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Associação inválida'},{status:400});
 const d=parsed.data;
 const [result]=await queryForMunicipality<{eligible:boolean;changed:boolean}>(
  user.municipality_id,operation==='grant'?GRANT_SECRETARIAT_MEMBER_SQL:REVOKE_SECRETARIAT_MEMBER_SQL,
  [user.municipality_id,d.secretariatId,d.userId,user.id],user.id);
 if(!result?.eligible)return NextResponse.json({
  error:'Secretaria ou conta não encontrada, inativa ou sem vínculo'
 },{status:404});
 if(operation==='revoke'&&!result.changed)return NextResponse.json({
  error:'Reatribua ou conclua as tarefas em aberto antes de revogar o vínculo'
 },{status:409});
 return NextResponse.json({ok:true,changed:result.changed});
}
export async function POST(request:Request){return modify(request,'grant');}
export async function PATCH(request:Request){return modify(request,'revoke');}
