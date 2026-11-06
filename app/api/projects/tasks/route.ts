import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { validateDate } from '@/lib/document-validity.mjs';
import { CREATE_MUNICIPAL_TASK_SQL } from '@/lib/municipal-task-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),secretariatId:z.string().uuid(),assignedTo:z.string().uuid(),
 title:z.string().trim().min(5).max(180),details:z.string().trim().max(1200),
 dueOn:z.string().refine(d=>validateDate(d)&&d>='2000-01-01'&&d<='2100-12-31'),
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Somente administradores podem distribuir tarefas'},{status:403});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Dados da tarefa, prazo ou responsável inválidos'},{status:400});
 const d=parsed.data;
 const [result]=await queryForMunicipality<{id:string|null;created:boolean}>(
  user.municipality_id,CREATE_MUNICIPAL_TASK_SQL,
  [user.municipality_id,d.projectId,d.secretariatId,d.assignedTo,d.title,d.details,d.dueOn,user.id],
  user.id);
 if(!result?.id)return NextResponse.json({
  error:'Projeto, secretaria ou responsável autorizado não encontrado neste município'
 },{status:404});
 return NextResponse.json({id:result.id,revision:1},{status:201});
}
