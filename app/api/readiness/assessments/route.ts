import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {calculateReadiness} from '@/lib/readiness-policy.mjs';
import {CREATE_READINESS_ASSESSMENT_SQL} from '@/lib/readiness-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 caseId:z.string().uuid(),rubricId:z.string().uuid(),
 expectedRevision:z.number().int().min(0).max(999),
 answers:z.array(z.object({
  id:z.string().max(50),score:z.number().int().min(0).max(100).nullable(),
  evidence:z.string().max(2000).optional()
 }).strict()).max(30),
 blockers:z.array(z.object({
  code:z.string().max(40),evidence:z.string().max(1000)
 }).strict()).max(8),
 revisionNote:z.string().trim().min(15).max(500)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_READINESS_EVALUATOR!=='yes')
  return NextResponse.json({error:'Avaliador aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão obrigatória'},{status:401});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Avaliação inválida'},{status:400});
 const d=parsed.data;
 const [rubric]=await queryForMunicipality<{id:string;version:number;criteria:Array<{id:string;label:string;weight:number}>}>(
  actor.municipality_id,'SELECT id,version,criteria FROM readiness_rubric_versions WHERE id=$1 AND municipality_id=$2',
  [d.rubricId,actor.municipality_id],actor.id);
 if(!rubric)return NextResponse.json({error:'Rubrica indisponível'},{status:404});
 let evaluation:ReturnType<typeof calculateReadiness>;
 try{evaluation=calculateReadiness(rubric.criteria,d.answers,d.blockers);}catch{
  return NextResponse.json({error:'Notas, evidências ou impedimentos inválidos'},{status:422});
 }
 const [row]=await queryForMunicipality<{
  authorized:boolean;rubric_found:boolean;kind:string|null;
  evidence_count:number;prior_revision:number|null;id:string|null;saved_revision:number|null
 }>(actor.municipality_id,CREATE_READINESS_ASSESSMENT_SQL,[
  actor.municipality_id,d.caseId,actor.id,d.rubricId,
  JSON.stringify(evaluation.breakdown.map((x:{id:string;score:number|null;evidence:string|null})=>({id:x.id,score:x.score,evidence:x.evidence}))),
  JSON.stringify(evaluation.blockers),JSON.stringify(evaluation.actions),
  evaluation.score,evaluation.maximumPossibleScore,evaluation.evaluatedWeight,
  d.revisionNote,d.expectedRevision
 ],actor.id);
 if(!row?.authorized)return NextResponse.json({error:'Avaliação indisponível ao responsável'},{status:404});
 if(!row.rubric_found)return NextResponse.json({error:'Rubrica indisponível'},{status:404});
 if(row.kind==='documented'&&row.evidence_count===0)
  return NextResponse.json({error:'Vincule uma versão documental antes de avaliar'},{status:422});
 if(!row.id)return NextResponse.json({error:'Versão concorrente; atualize e reavalie'},{status:409});
 return NextResponse.json({id:row.id,revision:row.saved_revision,score:evaluation.score,
  complete:evaluation.complete,hasPotentialBlockers:evaluation.blockers.length>0,
  scope:'avaliacao_preliminar_interna'},{
  status:201,headers:{'cache-control':'no-store'}
 });
}
