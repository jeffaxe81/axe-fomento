import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import {
 SUBMIT_INTERNAL_REVIEW_SQL,TECHNICAL_REVIEW_SQL,
 RETURN_INTERNAL_REVIEW_SQL,AUTHORIZE_INTERNAL_REVIEW_SQL,
 REVIEW_READINESS_SQL,
} from '@/lib/internal-review-sql.mjs';

export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),
 action:z.enum(['submit','technical_approve','return','authorize']),
 expectedRevision:z.number().int().min(0).max(10000),
 note:z.string().trim().min(10).max(500),
}).strict();
type Result={allowed:boolean;revision:number|null;current_revision?:number|null};
type Readiness={
 has_checklist:boolean;pending_documents:number;open_tasks:number;
 mandatory_requirements_missing:number;
};

export async function POST(request:Request){
 const rejected=rejectUntrustedWrite(request);
 if(rejected)return rejected;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let payload:unknown;
 try{payload=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({error:'Decisão, revisão ou justificativa inválidas'},
  {status:400});
 const d=parsed.data;
 if(d.action!=='submit'&&user.role!=='admin')
  return NextResponse.json({error:'A revisão e a autorização exigem administrador municipal'},
   {status:403});
 const statements={
  submit:SUBMIT_INTERNAL_REVIEW_SQL,
  technical_approve:TECHNICAL_REVIEW_SQL,
  return:RETURN_INTERNAL_REVIEW_SQL,
  authorize:AUTHORIZE_INTERNAL_REVIEW_SQL,
 };
 const [result]=await queryForMunicipality<Result>(
  user.municipality_id,statements[d.action],
  [user.municipality_id,d.projectId,user.id,d.expectedRevision,d.note],user.id);
 if(!result?.allowed)return NextResponse.json({
  error:'Projeto ou etapa de revisão indisponível para esta conta'
 },{status:404});
 if(result.revision===null){
  if(d.action==='technical_approve'||d.action==='authorize'){
   const [readiness]=await queryForMunicipality<Readiness>(
    user.municipality_id,REVIEW_READINESS_SQL,
    [user.municipality_id,d.projectId],user.id);
   if(readiness&&(!readiness.has_checklist||readiness.pending_documents>0||
      readiness.open_tasks>0||readiness.mandatory_requirements_missing>0)){
    return NextResponse.json({
     error:'Há impedimentos na documentação, tarefas ou requisitos obrigatórios. Revise a lista antes de autorizar.',
     blockers:readiness,
    },{status:409});
   }
  }
  return NextResponse.json({
   error:'Etapa ou versão desatualizada. Atualize a página antes de decidir.'
  },{status:409});
 }
 return NextResponse.json({ok:true,revision:result.revision,action:d.action},
  {headers:{'cache-control':'no-store'}});
}
