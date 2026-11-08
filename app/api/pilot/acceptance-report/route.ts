import {NextResponse} from 'next/server';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {buildV1AcceptanceReport} from '@/lib/v1-acceptance-report.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Contract={source:string;checked_at:string;result:string;route_count:number|null;schema_digest:string|null};
type Observation={id:string;source:string;external_code:string;observation_kind:string;reference_status:string;
 checked_on:string|null;closes_on:string|null;terms:Record<string,unknown>};
type NoticeReview={observation_id:string;review_state:string;eligibility_state:string;created_at:string};
type Evidence={id:string;gate_id:string;result_claimed:string;performed_on:string;created_by:string;
 evidence_sha256:string|null;created_at:string};
type GateReview={evidence_id:string;reviewed_by:string;decision:string;acceptance_url:string|null;created_at:string};
export async function GET(){
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 const [contracts,observations,pilotEvidence]=await Promise.all([
  queryForMunicipality<Contract>(actor.municipality_id,
   'SELECT DISTINCT ON (source) source,checked_at,result,route_count,schema_digest '+
   'FROM source_contract_checks WHERE municipality_id=$1 ORDER BY source,checked_at DESC,id DESC',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Observation>(actor.municipality_id,
   'SELECT * FROM (SELECT DISTINCT ON(source,external_code) id,source,external_code,'+
   'observation_kind,reference_status,checked_on::text AS checked_on,'+
   'closes_on::text AS closes_on,terms FROM funding_observations '+
   'WHERE municipality_id=$1 ORDER BY source,external_code,created_at DESC,id DESC) last '+
   'ORDER BY source,external_code LIMIT 100',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Evidence>(actor.municipality_id,
   'SELECT DISTINCT ON(gate_id) id,gate_id,result_claimed,performed_on::text AS performed_on,'+
   'created_by,evidence_sha256,created_at FROM pilot_gate_evidence '+
   'WHERE municipality_id=$1 ORDER BY gate_id,created_at DESC,id DESC',
   [actor.municipality_id],actor.id)
 ]);
 const observationIds=observations.map(o=>o.id);
 const evidenceIds=pilotEvidence.map(e=>e.id);
 const [noticeReviews,pilotReviews]=await Promise.all([
  observationIds.length?queryForMunicipality<NoticeReview>(actor.municipality_id,
   'SELECT observation_id,review_state,eligibility_state,created_at FROM funding_notice_reviews '+
   'WHERE municipality_id=$1 AND observation_id=ANY($2::uuid[]) '+
   'ORDER BY created_at DESC,id DESC LIMIT 400',
   [actor.municipality_id,observationIds],actor.id):Promise.resolve([]),
  evidenceIds.length?queryForMunicipality<GateReview>(actor.municipality_id,
   'SELECT evidence_id,reviewed_by,decision,acceptance_url,created_at FROM pilot_gate_reviews '+
   'WHERE municipality_id=$1 AND evidence_id=ANY($2::uuid[]) '+
   'ORDER BY created_at DESC,id DESC LIMIT 200',
   [actor.municipality_id,evidenceIds],actor.id):Promise.resolve([])
 ]);
 const {report,sha256}=buildV1AcceptanceReport({
  municipalityId:actor.municipality_id,exportedAt:new Date().toISOString(),
  sourceChecks:contracts,observations,noticeReviews,pilotEvidence,pilotReviews
 });
 return NextResponse.json({sha256,report},{headers:{
  'cache-control':'private, no-store, max-age=0',
  'content-disposition':'attachment; filename="axe-fomento-v1-evidencias.json"',
  'x-content-type-options':'nosniff'
 }});
}
