import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {validateProposalSections} from '@/lib/proposal-draft.mjs';
import {EDIT_PROPOSAL_SQL} from '@/lib/proposal-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),
 draftId:z.string().uuid(),
 expectedVersion:z.number().int().min(1).max(499),
 sections:z.record(z.unknown()),
 revisionNote:z.string().trim().min(10).max(500)
}).strict();
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
 if(!parsed.success)return NextResponse.json({error:'Revisão inválida'},{status:400});
 const d=parsed.data,sections=validateProposalSections(d.sections);
 if(!sections)return NextResponse.json({
  error:'Seções incompletas ou com formato inválido'
 },{status:400});
 const [row]=await queryForMunicipality<{
  eligible:boolean;current_version:number|null;saved_version:number|null
 }>(user.municipality_id,EDIT_PROPOSAL_SQL,[
  user.municipality_id,d.projectId,d.draftId,JSON.stringify(sections),
  d.revisionNote,user.id,d.expectedVersion
 ],user.id);
 if(!row?.eligible)return NextResponse.json({
  error:'Rascunho indisponível ao responsável'
 },{status:404});
 if(!row.saved_version)return NextResponse.json({
  error:'Versão desatualizada: atualize a página antes de gravar'
 },{status:409});
 return NextResponse.json({version:row.saved_version},
  {status:201,headers:{'cache-control':'no-store'}});
}
