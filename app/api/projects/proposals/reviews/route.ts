import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {INSERT_PROPOSAL_REVIEW_SQL} from '@/lib/proposal-review-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),
 draftId:z.string().uuid(),
 versionId:z.string().uuid(),
 decision:z.enum(['aprovada','devolvida']),
 reviewNote:z.string().trim().min(15).max(1000),
 acknowledgedMissingSources:z.boolean(),
 expectedReviewRevision:z.number().int().min(0).max(999)
}).strict();

export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);
 if(blocked)return blocked;
 if(process.env.ENABLE_PROPOSAL_CONTENT_REVIEWS!=='yes')
  return NextResponse.json({error:'Revisão de conteúdo ainda não homologada'},{status:503});
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Ação reservada ao revisor municipal'},{status:403});
 let value:unknown;
 try{value=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(value);
 if(!parsed.success)return NextResponse.json({error:'Dados de revisão inválidos'},{status:400});
 const d=parsed.data;
 if(d.decision==='aprovada'&&!d.acknowledgedMissingSources)
  return NextResponse.json({
   error:'Aprovação editorial exige ciência das pendências e das fontes não verificadas'
  },{status:422});
 const [result]=await queryForMunicipality<{
  eligible:boolean;placeholders:boolean;
  current_revision:number;saved_revision:number|null
 }>(user.municipality_id,INSERT_PROPOSAL_REVIEW_SQL,[
  user.municipality_id,d.projectId,d.draftId,d.versionId,
  d.decision,d.reviewNote,d.acknowledgedMissingSources,user.id,
  d.expectedReviewRevision
 ],user.id);
 if(!result?.eligible)return NextResponse.json({
  error:'Versão não encontrada, desatualizada ou atribuída ao próprio revisor'
 },{status:404});
 if(d.decision==='aprovada'&&result.placeholders)
  return NextResponse.json({
   error:'Existem marcadores de preenchimento pendentes. Devolva para ajustes antes de aprovar.'
  },{status:422});
 if(result.saved_revision===null)return NextResponse.json({
  error:'Revisão concorrente ou desatualizada; recarregue o histórico antes de decidir'
 },{status:409});
 return NextResponse.json({
  revision:result.saved_revision,decision:d.decision,
  scope:'revisao_editorial_interna',versionId:d.versionId
 },{status:201,headers:{'cache-control':'no-store'}});
}
