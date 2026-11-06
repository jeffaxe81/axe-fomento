import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { CREATE_SECRETARIAT_SQL } from '@/lib/municipal-task-sql.mjs';
export const runtime='nodejs';
const schema=z.object({name:z.string().trim().min(3).max(120)}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Somente administradores podem criar secretarias'},{status:403});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Nome da secretaria inválido'},{status:400});
 const [result]=await queryForMunicipality<{id:string|null;linked:boolean}>(
  user.municipality_id,CREATE_SECRETARIAT_SQL,[user.municipality_id,parsed.data.name,user.id],user.id);
 if(!result?.id)return NextResponse.json({error:'Esta secretaria já existe neste município'},{status:409});
 return NextResponse.json({id:result.id},{status:201});
}
