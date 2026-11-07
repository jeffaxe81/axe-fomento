import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {CREATE_MODALITY_CHECK_SQL} from '@/lib/modality-map-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),
 modality:z.enum(['convenio','transferencia','financiamento','cooperacao','outra']),
 ruleNumber:z.number().int().min(1).max(200),
 criterion:z.string().trim().min(10).max(500),
 normativeVersionId:z.string().uuid(),
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_MODALITY_MAP!=='yes')
  return NextResponse.json({error:'Enquadramento não homologado'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Não autenticado'},{status:401});
 let payload:unknown;
 try{payload=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({error:'Critério inválido'},{status:400});
 const d=parsed.data;
 const [row]=await queryForMunicipality<{eligible:boolean;id:string|null;saved:boolean}>(
  actor.municipality_id,CREATE_MODALITY_CHECK_SQL,
  [actor.municipality_id,d.projectId,d.modality,d.ruleNumber,d.criterion,
   d.normativeVersionId,actor.id],actor.id);
 if(!row?.eligible)return NextResponse.json({
  error:'Projeto ou versão normativa indisponível ao responsável deste município'
 },{status:404});
 if(!row.saved)return NextResponse.json({
  error:'Número de regra já utilizado nesta modalidade'
 },{status:409});
 return NextResponse.json({id:row.id,revision:1,status:'pendente'},
  {status:201,headers:{'cache-control':'no-store'}});
}
