import {createHash} from 'node:crypto';
import {PILOT_GATES,pilotEvidenceSummary,isEvidenceUrl} from './pilot-gates.mjs';

export const V1_ACCEPTANCE_REPORT_VERSION='axe-fomento-v1-acceptance/1';

/** Builds an auditable readiness snapshot from municipality-scoped SQL rows.
 * Never asserts that a public notice is really open or that production is authorized.
 * Excludes notes, user data and tokens from the export. */
export function buildV1AcceptanceReport({
 municipalityId,exportedAt,sourceChecks=[],observations=[],noticeReviews=[],
 pilotEvidence=[],pilotReviews=[]
}){
 if(typeof municipalityId!=='string'||!municipalityId||
  typeof exportedAt!=='string'||!Number.isFinite(Date.parse(exportedAt)))
  throw new Error('Identificação ou data inválida');
 const latestCheck=new Map();
 for(const check of sourceChecks){
  if(!['parcerias','discricionarias'].includes(check.source)||latestCheck.has(check.source))continue;
  latestCheck.set(check.source,{
   module:check.source,checkedAt:check.checked_at,result:check.result,
   routeCount:check.route_count??null,contractDigest:check.schema_digest??null,
   verifiesLiveNotice:false
  });
 }
 const latestReview=new Map();
 for(const review of noticeReviews){
  if(!latestReview.has(review.observation_id))latestReview.set(review.observation_id,review);
 }
 const noticeItems=observations.map(o=>{
  const review=latestReview.get(o.id);
  const positive=review?.review_state==='confirmed_by_reviewer'&&
   review?.eligibility_state==='potential'&&
   o.reference_status==='conferida_por_operador'&&
   o.observation_kind==='oportunidade_conferida';
  return {
   id:o.id,code:o.external_code,source:o.source,observationKind:o.observation_kind,
   reviewState:review?.review_state??'not_reviewed',
   eligibility:review?.eligibility_state??'undetermined',
   noticeDocumentDeclared:Boolean(o.terms?.noticeEvidence?.noticeUrl),
   closesOn:o.closes_on??null,checkedOn:o.checked_on??null,
   secondReviewerPositive:Boolean(positive),
   officialAuthorityVerified:false
  };
 });
 const evidenceByGate=new Map();
 for(const e of pilotEvidence){
  if(!PILOT_GATES.some(g=>g.id===e.gate_id)||evidenceByGate.has(e.gate_id))continue;
  evidenceByGate.set(e.gate_id,e);
 }
 const reviewByEvidence=new Map();
 for(const r of pilotReviews){
  if(!reviewByEvidence.has(r.evidence_id))reviewByEvidence.set(r.evidence_id,r);
 }
 const gateItems=PILOT_GATES.map(g=>{
  const evidence=evidenceByGate.get(g.id),review=evidence&&reviewByEvidence.get(evidence.id);
  const positive=Boolean(evidence?.result_claimed==='pass'&&
   review?.decision==='accepted'&&review.reviewed_by!==evidence.created_by&&
   isEvidenceUrl(review.acceptance_url));
  return {
   id:g.id,title:g.title,expectedEvidence:g.required,
   declaredResult:evidence?.result_claimed??'not_recorded',
   performedOn:evidence?.performed_on??null,
   evidenceSha256:evidence?.evidence_sha256??null,
   secondPersonReview:review?.decision??'not_reviewed',
   internalEvidenceReviewed:positive,
   fieldApproved:false
  };
 });
 const summary=pilotEvidenceSummary(pilotEvidence,pilotReviews);
 const report={
  format:V1_ACCEPTANCE_REPORT_VERSION,municipalityId,exportedAt,
  release:'V1',source:'municipal records and portal contract metadata',
  notes:[
   'Este relatorio contem apenas dados cadastrais e pareceres internos, sem certificacao da autoridade concedente.',
   'Contrato OpenAPI nao comprova edital aberto, prazo vigente ou elegibilidade do municipio.',
   'Teste CI ou revisao interna nao substitui ensaio em ambiente-alvo nem aceite institucional.'
  ],
  publicSourceContracts:[...latestCheck.values()],
  noticeReview:{
   recordsExamined:observations.length,
   documentsDeclared:noticeItems.filter(o=>o.noticeDocumentDeclared).length,
   positiveMunicipalSecondReviews:noticeItems.filter(o=>o.secondReviewerPositive).length,
   authorityValidatedCount:0,
   items:noticeItems
  },
  operationalPilot:{
   declaredEvidenceGates:summary.recordedGateCount,
   declaredPassGates:summary.declaredPass,
   internallyReviewedGates:summary.independentlyApproved,
   fieldApprovedGates:0,
   requiredGates:PILOT_GATES.length,
   gates:gateItems
  },
  acceptance:{
   V1_07:'PENDING_EXTERNAL_SOURCE_VALIDATION',
   V1_08:'PENDING_FIELD_PILOT_AND_INSTITUTIONAL_APPROVAL',
   productionDecision:'NO-GO',deploymentAuthorized:false
  },
  pending:[
   'V1-07: comprovar na fonte oficial edital especifico e enquadramento municipal com exemplos positivo/negativo.',
   'V1-08: ensaiar OP-01..08 no ambiente-alvo e obter autorizacao institucional assinada.'
  ]
 };
 const checksum=createHash('sha256').update(JSON.stringify(report)).digest('hex');
 return {report,sha256:checksum};
}
