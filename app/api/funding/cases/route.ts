import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
export const runtime='nodejs';
const schema=z.object({projectId:z.string().uuid(),observationId:z.string().uuid()}).strict();
export async function GET(){
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 const cases=await queryForMunicipality(actor.municipality_id,
  'SELECT c.id,c.project_id,c.observation_id,c.created_at,p.title AS project_title,'+
  'o.title AS offer_title,o.source,o.source_url,o.modality,'+
  'EXISTS(SELECT 1 FROM funding_observations newer WHERE newer.municipality_id=o.municipality_id '+
  'AND newer.source=o.source AND newer.external_code=o.external_code '+
  'AND (newer.created_at,newer.id)>(o.created_at,o.id)) AS is_superseded,'+
  '(SELECT COUNT(*)::int FROM funding_case_events e WHERE e.case_id=c.id) AS event_count '+
  'FROM funding_cases c JOIN projects p ON p.id=c.project_id '+
  'JOIN funding_observations o ON o.id=c.observation_id '+
  'WHERE c.municipality_id=$1 ORDER BY c.created_at DESC,c.id DESC LIMIT 200',
  [actor.municipality_id],actor.id);
 return NextResponse.json({cases},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request){
 const origin=rejectUntrustedWrite(request);if(origin)return origin;
 if(process.env.ENABLE_FUNDING_PIPELINE!=='yes')return NextResponse.json({error:'Módulo em homologação'},{status:503});
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const x=schema.safeParse(body);if(!x.success)return NextResponse.json({error:'Vínculo inválido'},{status:400});
 const [row]=await queryForMunicipality<{id:string}>(actor.municipality_id,
  'INSERT INTO funding_cases(municipality_id,project_id,observation_id,created_by) '+
  'SELECT $1,p.id,o.id,$4 FROM projects p JOIN funding_observations o ON o.id=$3 AND o.municipality_id=$1 '+
  'WHERE p.id=$2 AND p.municipality_id=$1 AND '+
  "o.observation_kind='oportunidade_conferida' AND "+
  "o.reference_status='conferida_por_operador' AND "+
  "o.checked_on BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '30 days' AND (now() AT TIME ZONE 'America/Sao_Paulo')::date AND "+
  "o.terms ? 'noticeEvidence' AND "+
  "(o.opens_on IS NULL OR o.opens_on <= (now() AT TIME ZONE 'America/Sao_Paulo')::date) AND "+
  "NOT EXISTS(SELECT 1 FROM funding_observations newer WHERE newer.municipality_id=o.municipality_id "+
  "AND newer.source=o.source AND newer.external_code=o.external_code "+
  "AND (newer.created_at,newer.id)>(o.created_at,o.id)) AND "+
  "(o.closes_on IS NULL OR o.closes_on>=(now() AT TIME ZONE 'America/Sao_Paulo')::date) AND "+
  "($5::boolean=false OR (EXISTS(SELECT 1 FROM funding_notice_reviews r "+
  "WHERE r.municipality_id=o.municipality_id AND r.observation_id=o.id "+
  "AND r.review_state='confirmed_by_reviewer' AND r.eligibility_state='potential' "+
  "AND r.reviewed_on BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo')::date-INTERVAL '30 days' "+
  "AND (now() AT TIME ZONE 'America/Sao_Paulo')::date) "+
  "AND NOT EXISTS(SELECT 1 FROM funding_notice_reviews rejected "+
  "WHERE rejected.municipality_id=o.municipality_id AND rejected.observation_id=o.id "+
  "AND rejected.review_state<>'confirmed_by_reviewer'))) AND "+
  '(p.owner_user_id=$4 OR EXISTS(SELECT 1 FROM users u WHERE u.id=$4 AND u.role=\'admin\' AND u.active)) '+
  'ON CONFLICT (municipality_id,project_id,observation_id) DO NOTHING RETURNING id',
  [actor.municipality_id,x.data.projectId,x.data.observationId,actor.id,
   process.env.ENABLE_NOTICE_REVIEW_GATE==='yes'],actor.id);
 if(!row)return NextResponse.json({error:'Projeto/fonte indisponível, acesso negado ou vínculo existente'},{status:409});
 return NextResponse.json({id:row.id},{status:201,headers:{'cache-control':'no-store'}});
}
