import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { validateDate } from '@/lib/document-validity.mjs';
import { UPDATE_TASK_STATUS_SQL,TRANSFER_MUNICIPAL_TASK_SQL,CHANGE_TASK_DEADLINE_SQL }
 from '@/lib/municipal-task-sql.mjs';
export const runtime='nodejs';
const common={taskId:z.string().uuid(),expectedRevision:z.number().int().min(1).max(10000),
 note:z.string().trim().min(10).max(500)};
const schema=z.discriminatedUnion('action',[
 z.object({...common,action:z.literal('status'),
  status:z.enum(['pendente','em_andamento','concluida','cancelada'])}).strict(),
 z.object({...common,action:z.literal('transfer'),assignedTo:z.string().uuid()}).strict(),
 z.object({...common,action:z.literal('deadline'),
  dueOn:z.string().refine(d=>validateDate(d)&&d>='2000-01-01'&&d<='2100-12-31')}).strict(),
]);
export async function PATCH(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Operação de tarefa inválida'},{status:400});
 const d=parsed.data;
 if(d.action!=='status'&&user.role!=='admin')
  return NextResponse.json({error:'Somente administradores podem transferir ou alterar prazos'},{status:403});
 const statement=d.action==='status'?UPDATE_TASK_STATUS_SQL:
  d.action==='transfer'?TRANSFER_MUNICIPAL_TASK_SQL:CHANGE_TASK_DEADLINE_SQL;
 const value=d.action==='status'?d.status:d.action==='transfer'?d.assignedTo:d.dueOn;
 const [result]=await queryForMunicipality<{
  eligible:boolean;current_revision:number|null;changed:boolean;
 }>(user.municipality_id,statement,
  [user.municipality_id,d.taskId,user.id,value,d.expectedRevision,d.note],user.id);
 if(!result?.eligible)return NextResponse.json({
  error:'Tarefa indisponível ou responsável não autorizado'
 },{status:404});
 if(result.current_revision!==d.expectedRevision)return NextResponse.json({
  error:'Tarefa alterada por outra pessoa. Atualize a página antes de continuar'
 },{status:409});
 return NextResponse.json({ok:true,changed:result.changed,
  revision:result.changed?d.expectedRevision+1:d.expectedRevision},
  {headers:{'cache-control':'no-store'}});
}
