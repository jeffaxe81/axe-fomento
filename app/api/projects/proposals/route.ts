import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {READ_PROPOSAL_SOURCE_SQL,CREATE_PROPOSAL_SQL} from '@/lib/proposal-sql.mjs';
import {buildProposalDraft} from '@/lib/proposal-draft.mjs';
export const runtime='nodejs';
const schema=z.object({projectId:z.string().uuid()}).strict();
type Context={
 id:string;title:string;status:string;owner_user_id:string|null;
 opportunity_id:string|null;opportunity_title:string|null;
 opportunity_provider:string|null;opportunity_source_url:string|null;
 is_example:boolean|null;municipality_name:string;municipality_uf:string;
 budget_items:number;budget_total_cents:string;
 stages:unknown[];requirements:unknown[];edict_evidence:unknown[];
};
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_PROPOSAL_DRAFTS!=='yes')
  return NextResponse.json({error:'Rascunhos não homologados'},{status:503});
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let input:unknown;
 try{input=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(input);
 if(!parsed.success)return NextResponse.json({error:'Projeto inválido'},{status:400});
 const projectId=parsed.data.projectId;
 const [ctx]=await queryForMunicipality<Context>(user.municipality_id,
  READ_PROPOSAL_SOURCE_SQL,[user.municipality_id,projectId],user.id);
 if(!ctx||ctx.is_example||!(user.role==='admin'||ctx.owner_user_id===user.id))
  return NextResponse.json({error:'Projeto indisponível ao responsável'},{status:404});
 const generated=buildProposalDraft({
  project:{id:ctx.id,title:ctx.title,status:ctx.status},
  municipality:{name:ctx.municipality_name,uf:ctx.municipality_uf},
  opportunity:ctx.opportunity_id?{
   id:ctx.opportunity_id,title:ctx.opportunity_title,
   provider:ctx.opportunity_provider,sourceUrl:ctx.opportunity_source_url
  }:null,
  stages:ctx.stages,requirements:ctx.requirements,
  edictEvidence:ctx.edict_evidence,budgetItems:ctx.budget_items,
  budgetTotalCents:ctx.budget_total_cents
 });
 if(!generated)return NextResponse.json({
  error:'Dados de origem inconsistentes; requerem conferência'
 },{status:422});
 const [result]=await queryForMunicipality<{
  eligible:boolean;draft_id:string|null;version:number|null
 }>(user.municipality_id,CREATE_PROPOSAL_SQL,[
  user.municipality_id,projectId,JSON.stringify(generated.sections),
  JSON.stringify(generated.sourceSnapshot),generated.missingFields,user.id
 ],user.id);
 if(!result?.eligible)return NextResponse.json({error:'Projeto indisponível'},{status:404});
 if(!result.draft_id)return NextResponse.json({
  error:'Rascunho já existente. Edite a versão atual sem perder o histórico.'
 },{status:409});
 return NextResponse.json({
  draftId:result.draft_id,version:1,missingFields:generated.missingFields,
  origin:'template_from_local_data'
 },{status:201,headers:{'cache-control':'no-store'}});
}
