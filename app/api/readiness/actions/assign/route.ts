import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
export const runtime='nodejs';
const schema=z.object({
 assessmentId:z.string().uuid(),
 actionCode:z.string().regex(/^[a-z0-9_-]{3,80}$/),
 responsibleUserId:z.string().uuid(),
 expectedRevision:z.number().int().min(0).max(99),
 justification:z.string().trim().min(10).max(500)
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
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Atribuição inválida'},{status:400});
 const d=p.data;
 const [row]=await queryForMunicipality<{eligible:boolean;id:string|null;revision:number|null}>(
  actor.municipality_id,`
  WITH eligible AS MATERIALIZED(
   SELECT a.id,a.case_id,a.municipality_id
   FROM readiness_assessments a JOIN readiness_cases c
    ON c.id=a.case_id AND c.municipality_id=a.municipality_id
   JOIN users actor ON actor.id=$2::uuid AND actor.municipality_id=a.municipality_id
    AND actor.active AND (actor.role='admin' OR c.created_by=actor.id)
   JOIN users responsible ON responsible.id=$5::uuid
    AND responsible.municipality_id=a.municipality_id AND responsible.active
   WHERE a.municipality_id=$1::uuid AND a.id=$3::uuid
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.action_plan_snapshot) item
     WHERE item->>'id'=$4::text)
  ), previous AS MATERIALIZED(
   SELECT COALESCE(max(revision),0)::integer AS revision
   FROM readiness_action_assignments
   WHERE municipality_id=$1::uuid AND assessment_id=$3::uuid AND action_code=$4::text
  ), saved AS(
   INSERT INTO readiness_action_assignments(municipality_id,case_id,assessment_id,
    action_code,revision,responsible_user_id,justification,assigned_by)
   SELECT e.municipality_id,e.case_id,e.id,$4::text,
    p.revision+1,$5::uuid,$7::text,$2::uuid
   FROM eligible e CROSS JOIN previous p WHERE p.revision=$6::integer
   ON CONFLICT(assessment_id,action_code,revision) DO NOTHING
   RETURNING id,revision
  )
  SELECT EXISTS(SELECT 1 FROM eligible) AS eligible,
   (SELECT id FROM saved) AS id,(SELECT revision FROM saved) AS revision`,[
   actor.municipality_id,actor.id,d.assessmentId,d.actionCode,
   d.responsibleUserId,d.expectedRevision,d.justification
  ],actor.id);
 if(!row?.eligible)return NextResponse.json({error:'Ação ou responsável indisponível'},{status:404});
 if(!row.id)return NextResponse.json({error:'Atribuição concorrente; atualize a ficha'},{status:409});
 return NextResponse.json({id:row.id,revision:row.revision},{
  status:201,headers:{'cache-control':'no-store'}});
}
