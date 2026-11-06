import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {validateDate} from '@/lib/document-validity.mjs';
import {CREATE_BUDGET_STAGE_SQL} from '@/lib/project-budget-sql.mjs';

export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),
 stageNumber:z.number().int().min(1).max(200),
 title:z.string().trim().min(5).max(160),
 startsOn:z.string(),endsOn:z.string(),
 assumptions:z.string().trim().min(10).max(1200)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_PROJECT_BUDGET!=='yes')
  return NextResponse.json({error:'Orçamento ainda não homologado'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Etapa inválida'},{status:400});
 const x=parsed.data;
 if(!validateDate(x.startsOn)||!validateDate(x.endsOn)||
  x.startsOn<'2000-01-01'||x.endsOn>'2100-12-31'||x.startsOn>x.endsOn)
  return NextResponse.json({error:'Período de execução inválido'},{status:400});
 const [result]=await queryForMunicipality<{eligible:boolean;id:string|null;saved:boolean}>(
  actor.municipality_id,CREATE_BUDGET_STAGE_SQL,
  [actor.municipality_id,x.projectId,x.stageNumber,x.title,
   x.startsOn,x.endsOn,x.assumptions,actor.id],actor.id);
 if(!result?.eligible)return NextResponse.json({
  error:'Projeto indisponível para orçamento deste município e usuário'
 },{status:404});
 if(!result.saved)return NextResponse.json({
  error:'Já existe etapa com esse número no projeto'
 },{status:409});
 return NextResponse.json({id:result.id},{status:201,headers:{'cache-control':'no-store'}});
}
