import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {REVIEW_EDICT_SUGGESTION_SQL} from '@/lib/edict-extraction-sql.mjs';
export const runtime='nodejs';

const schema=z.object({
 projectId:z.string().uuid(),
 suggestionId:z.string().uuid(),
 expectedRevision:z.number().int().min(0).max(999),
 decision:z.enum(['pendente','aprovada','rejeitada']),
 reviewNote:z.string().trim().min(10).max(1000),
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);
 if(blocked)return blocked;
 if(process.env.ENABLE_EDICT_ASSISTED_EXTRACTION!=='yes')
  return NextResponse.json({error:'Revisão de extração não homologada'},{status:503});
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Não autenticado'},{status:401});
 let data:unknown;
 try{data=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(data);
 if(!parsed.success)return NextResponse.json({
  error:'Decisão inválida ou sem justificativa suficiente'
 },{status:400});
 const d=parsed.data;
 const [row]=await queryForMunicipality<{
  eligible:boolean;has_evidence:boolean;current_revision:number;saved_revision:number|null
 }>(user.municipality_id,REVIEW_EDICT_SUGGESTION_SQL,[
  user.municipality_id,d.projectId,d.suggestionId,d.expectedRevision,
  d.decision,d.reviewNote,user.id
 ],user.id);
 if(!row?.eligible)return NextResponse.json({
  error:'Sugestão não encontrada ou usuário sem responsabilidade sobre projeto'
 },{status:404});
 if(d.decision==='aprovada'&&!row.has_evidence)return NextResponse.json({
  error:'Sem trecho de evidência: sugestão deve permanecer pendente ou ser rejeitada'
 },{status:422});
 if(row.saved_revision===null)return NextResponse.json({
  error:'Revisão desatualizada; recarregue o lote e reavalie'
 },{status:409});
 return NextResponse.json({revision:row.saved_revision,decision:d.decision},
  {status:201,headers:{'cache-control':'no-store'}});
}
