import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {validateDate} from '@/lib/document-validity.mjs';
import {parseBRLToCents} from '@/lib/financial-money.mjs';
import {CREATE_FINANCIAL_MILESTONE_SQL} from '@/lib/financial-milestone-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),protocolId:z.string().uuid(),
 kind:z.enum(['repasse','marco']),
 title:z.string().trim().min(5).max(180),
 plannedOn:z.string(),plannedAmount:z.string(),
 note:z.string().trim().min(10).max(1000)
}).strict();
export async function POST(request:Request){
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
 if(!parsed.success)return NextResponse.json({error:'Dados financeiros inválidos'},{status:400});
 const x=parsed.data;
 const amount=parseBRLToCents(x.plannedAmount);
 if(!validateDate(x.plannedOn)||x.plannedOn<'2000-01-01'||
  x.plannedOn>'2100-12-31'||amount===null||
  (x.kind==='repasse'&&BigInt(amount)===0n))
  return NextResponse.json({error:'Data ou valor previsto inválido'},{status:400});
 const [saved]=await queryForMunicipality<{id:string|null;created:boolean}>(
  actor.municipality_id,CREATE_FINANCIAL_MILESTONE_SQL,
  [actor.municipality_id,x.projectId,x.protocolId,x.kind,x.title,
   x.plannedOn,amount,x.note,actor.id],actor.id);
 if(!saved?.created)return NextResponse.json({
  error:'Projeto ou protocolo não disponível para registro neste município'
 },{status:404});
 return NextResponse.json({id:saved.id},{status:201,headers:{'cache-control':'no-store'}});
}
