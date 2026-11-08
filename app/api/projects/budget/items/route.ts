import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {budgetInput} from '@/lib/budget-math.mjs';
import {CREATE_BUDGET_ITEM_SQL} from '@/lib/project-budget-sql.mjs';

export const runtime='nodejs';
const unit=z.enum(['un','m','m2','m3','km','kg','hora','dia','mes','servico']);
const schema=z.object({
 projectId:z.string().uuid(),stageId:z.string().uuid(),
 lineNumber:z.number().int().min(1).max(9999),
 title:z.string().trim().min(5).max(160),unit,
 quantity:z.string(),unitCost:z.string(),
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
 if(!parsed.success)return NextResponse.json({error:'Item orçamentário inválido'},{status:400});
 const x=parsed.data,money=budgetInput(x.quantity,x.unitCost);
 if(!money)return NextResponse.json({
  error:'Quantidade ou custo inválido; informe até 3 casas na quantidade, 2 no custo e respeite o limite de valor'
 },{status:400});
 const [result]=await queryForMunicipality<{
  eligible:boolean;id:string|null;line_total_cents:string|null;saved:boolean
 }>(actor.municipality_id,CREATE_BUDGET_ITEM_SQL,
  [actor.municipality_id,x.projectId,x.stageId,x.lineNumber,x.title,
   x.unit,money.quantityMilli,money.unitCostCents,x.assumptions,actor.id],actor.id);
 if(!result?.eligible)return NextResponse.json({
  error:'Etapa indisponível para orçamento deste projeto, município e usuário'
 },{status:404});
 if(!result.saved)return NextResponse.json({
  error:'Já existe item com esse número na etapa'
 },{status:409});
 return NextResponse.json({id:result.id,totalCents:result.line_total_cents},
  {status:201,headers:{'cache-control':'no-store'}});
}
