import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {REVIEW_MODALITY_CHECK_SQL} from '@/lib/modality-map-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),
 checkId:z.string().uuid(),
 expectedRevision:z.number().int().min(1).max(9999),
 status:z.enum(['pendente','atendido','nao_atendido','nao_aplicavel']),
 justification:z.string().trim().min(10).max(1000),
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
 if(!parsed.success)return NextResponse.json({
  error:'Revisão inválida ou sem justificativa fundamentada'
 },{status:400});
 const d=parsed.data;
 const [row]=await queryForMunicipality<{
  eligible:boolean;current_revision:number|null;saved_revision:number|null
 }>(actor.municipality_id,REVIEW_MODALITY_CHECK_SQL,[
  actor.municipality_id,d.projectId,d.checkId,d.expectedRevision,
  d.status,d.justification,actor.id
 ],actor.id);
 if(!row?.eligible)return NextResponse.json({
  error:'Critério indisponível ao responsável deste município'
 },{status:404});
 if(!row.saved_revision)return NextResponse.json({
  error:'Revisão desatualizada: atualize a página para conferir a última avaliação'
 },{status:409});
 return NextResponse.json({revision:row.saved_revision,status:d.status},
  {status:201,headers:{'cache-control':'no-store'}});
}
