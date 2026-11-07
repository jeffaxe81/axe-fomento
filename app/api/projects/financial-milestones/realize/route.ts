import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {todaySaoPaulo,validateDate} from '@/lib/document-validity.mjs';
import {parseBRLToCents} from '@/lib/financial-money.mjs';
import {REALIZE_FINANCIAL_MILESTONE_SQL} from '@/lib/financial-milestone-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 milestoneId:z.string().uuid(),
 expectedRevision:z.literal(1),
 realizedOn:z.string(),realizedAmount:z.string(),
 proofVersionId:z.string().uuid(),
 note:z.string().trim().min(10).max(1000)
}).strict();
export async function PATCH(request:Request){
 const badOrigin=rejectUntrustedWrite(request);if(badOrigin)return badOrigin;
 if(process.env.ENABLE_FINANCIAL_TRACKING!=='yes')
  return NextResponse.json({error:'Acompanhamento financeiro desabilitado até homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let payload:unknown;
 try{payload=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({error:'Dados da realização inválidos'},{status:400});
 const x=parsed.data;
 const amount=parseBRLToCents(x.realizedAmount);
 if(!validateDate(x.realizedOn)||x.realizedOn<'2000-01-01'||
  x.realizedOn>todaySaoPaulo()||amount===null)
  return NextResponse.json({error:'Data ou valor realizado inválido'},{status:400});
 const [result]=await queryForMunicipality<{
  eligible:boolean;current_revision:number|null;changed:boolean
 }>(actor.municipality_id,REALIZE_FINANCIAL_MILESTONE_SQL,
  [actor.municipality_id,x.milestoneId,actor.id,x.proofVersionId,
   x.expectedRevision,x.realizedOn,amount,x.note],actor.id);
 if(!result?.eligible)return NextResponse.json({
  error:'Marco ou comprovante indisponível para este usuário e município'
 },{status:404});
 if(!result.changed)return NextResponse.json({
  error:'Registro já realizado ou revisão desatualizada'
 },{status:409});
 return NextResponse.json({revision:2,changed:true},
  {status:200,headers:{'cache-control':'no-store'}});
}
