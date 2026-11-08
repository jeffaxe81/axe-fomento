import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {radarReferenceDate} from '@/lib/opportunity-deadline.mjs';
import {validDate} from '@/lib/funding-pipeline.mjs';
import {summarizeNoticeReviews,validateIndependentNoticeReview} from '@/lib/notice-review-policy.mjs';
export const runtime='nodejs';
const schema=z.object({
 observationId:z.string().uuid(),
 reviewState:z.enum(['confirmed_by_reviewer','rejected_by_reviewer','insufficient_evidence']),
 eligibilityState:z.enum(['potential','possible_impediment','undetermined']),
 officialDocumentUrl:z.string().url().max(500),
 reviewedOn:z.string(),
 reason:z.string().trim().min(60).max(1500),
 requirementsNote:z.string().trim().min(40).max(1500)
}).strict();
type Observation={
 id:string;created_by:string;observation_kind:string;reference_status:string;source:string;
 external_code:string;title:string;source_url:string;opens_on:string|null;closes_on:string|null;
 checked_on:string|null;terms:Record<string,unknown>
};
type Municipality={population:number|null;priority_areas:string[]};
type Review={
 id:string;observation_id:string;reviewed_by:string;review_state:string;eligibility_state:string;
 official_document_url:string;reviewed_on:string;reason:string;requirements_note:string;created_at:string
};
export async function GET(){
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 const rows=await queryForMunicipality<Review>(actor.municipality_id,
  'SELECT id,observation_id,reviewed_by,review_state,eligibility_state,official_document_url,'+
  'reviewed_on::text AS reviewed_on,reason,requirements_note,created_at '+
  'FROM funding_notice_reviews WHERE municipality_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',
  [actor.municipality_id],actor.id);
 return NextResponse.json({reviews:rows,summary:summarizeNoticeReviews(rows),
  scope:'parecer_humano_municipal_sem_certificacao_externa',
  enabled:process.env.ENABLE_NOTICE_REVIEW==='yes'},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 if(process.env.ENABLE_NOTICE_REVIEW!=='yes')
  return NextResponse.json({error:'Conferência documental desabilitada neste ambiente'},{status:503});
 let raw:unknown;
 try{raw=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const parsed=schema.safeParse(raw);
 if(!parsed.success)return NextResponse.json({error:'Parecer inválido'},{status:400});
 const x=parsed.data,today=radarReferenceDate().toISOString().slice(0,10);
 if(!validDate(x.reviewedOn)||x.reviewedOn>today)
  return NextResponse.json({error:'Data da conferência inválida'},{status:400});
 const [[obs],[municipality]]=await Promise.all([
  queryForMunicipality<Observation>(actor.municipality_id,
   'SELECT id,created_by,observation_kind,reference_status,source,external_code,title,source_url,'+
   'opens_on::text AS opens_on,closes_on::text AS closes_on,checked_on::text AS checked_on,terms '+
   'FROM funding_observations WHERE municipality_id=$1 AND id=$2',
   [actor.municipality_id,x.observationId],actor.id),
  queryForMunicipality<Municipality>(actor.municipality_id,
   'SELECT population,priority_areas FROM municipalities WHERE id=$1',[actor.municipality_id],actor.id)
 ]);
 if(!obs||!municipality)return NextResponse.json({error:'Observação indisponível'},{status:404});
 const validation=validateIndependentNoticeReview(obs,municipality,actor.id,x,today);
 if(!validation.ok)return NextResponse.json({error:'Parecer não permitido',reason:validation.reason},{status:409});
 const [row]=await queryForMunicipality<{id:string}>(actor.municipality_id,
  'INSERT INTO funding_notice_reviews(municipality_id,observation_id,observation_author_id,reviewed_by,'+
  'review_state,eligibility_state,official_document_url,reviewed_on,reason,requirements_note) '+
  'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) '+
  'ON CONFLICT(observation_id,reviewed_by) DO NOTHING RETURNING id',
  [actor.municipality_id,obs.id,obs.created_by,actor.id,x.reviewState,x.eligibilityState,
   x.officialDocumentUrl,x.reviewedOn,x.reason,x.requirementsNote],actor.id);
 if(!row)return NextResponse.json({error:'Parecer deste revisor já foi registrado'},{status:409});
 return NextResponse.json({id:row.id,reviewState:x.reviewState,eligibility:x.eligibilityState,
  externallyCertified:false,notice:'Revisão humana interna, sem verificação automática da autoridade concedente.'},
  {status:201,headers:{'cache-control':'no-store'}});
}
