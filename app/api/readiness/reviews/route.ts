import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
export const runtime='nodejs';
const schema=z.object({
 assessmentId:z.string().uuid(),
 expectedRevision:z.number().int().min(0).max(99),
 decision:z.enum(['revisada','devolvida']),
 note:z.string().trim().min(20).max(1000)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_READINESS_EVALUATOR!=='yes')
  return NextResponse.json({error:'Avaliador aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão obrigatória'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Revisão exclusiva do administrador municipal'},{status:403});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Decisão inválida'},{status:400});
 const d=p.data;
 const [row]=await queryForMunicipality<{eligible:boolean;id:string|null;revision:number|null}>(
  actor.municipality_id,`
  WITH eligible AS MATERIALIZED(
   SELECT a.id,a.case_id,a.municipality_id
   FROM readiness_assessments a JOIN users u ON u.id=$2::uuid
    AND u.municipality_id=a.municipality_id AND u.active AND u.role='admin'
   WHERE a.id=$3::uuid AND a.municipality_id=$1::uuid
    AND a.created_by<>u.id
    AND NOT EXISTS(SELECT 1 FROM readiness_assessments newer
     WHERE newer.case_id=a.case_id AND newer.revision>a.revision)
  ), previous AS MATERIALIZED(
   SELECT COALESCE(max(revision),0)::integer AS revision
   FROM readiness_review_events WHERE assessment_id=$3::uuid
    AND municipality_id=$1::uuid
  ), saved AS(
   INSERT INTO readiness_review_events(municipality_id,case_id,assessment_id,
    revision,decision,note,reviewer_id)
   SELECT e.municipality_id,e.case_id,e.id,p.revision+1,
    $5::text,$6::text,$2::uuid
   FROM eligible e CROSS JOIN previous p
   WHERE p.revision=$4::integer
   ON CONFLICT(assessment_id,revision) DO NOTHING RETURNING id,revision
  )
  SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
   (SELECT id FROM saved) AS id,(SELECT revision FROM saved) AS revision`,[
   actor.municipality_id,actor.id,d.assessmentId,d.expectedRevision,
   d.decision,d.note
  ],actor.id);
 if(!row?.eligible)return NextResponse.json({error:'Avaliação indisponível ou de autoria própria'},{status:404});
 if(!row.id)return NextResponse.json({error:'Revisão concorrente; atualize a ficha'},{status:409});
 return NextResponse.json({id:row.id,revision:row.revision,decision:d.decision,
  scope:'revisao_interna_sem_efeito_oficial'},{
  status:201,headers:{'cache-control':'no-store'}});
}
