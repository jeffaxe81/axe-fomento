// V1 documentary review: an authenticated municipal administrator attests
// a document but this does not validate the actual government portal response.
import {classifyObservation,validateNoticeEvidence,municipalityOfferCompatibility} from './funding-pipeline.mjs';
export const NOTICE_REVIEW_STATES=Object.freeze([
 'confirmed_by_reviewer','rejected_by_reviewer','insufficient_evidence'
]);
export const MUNICIPAL_ELIGIBILITY_STATES=Object.freeze([
 'potential','possible_impediment','undetermined'
]);
export function validateIndependentNoticeReview(observation,municipality,reviewerId,input,today){
 if(!observation||!municipality||!input)return {ok:false,reason:'dados_ausentes'};
 if(observation.created_by===reviewerId)return {ok:false,reason:'autor_nao_pode_revisar'};
 const doc=observation.terms?.noticeEvidence;
 if(!validateNoticeEvidence(doc,today).ok||
  input.officialDocumentUrl!==doc.noticeUrl)
  return {ok:false,reason:'documento_primario_nao_corresponde'};
 if(!NOTICE_REVIEW_STATES.includes(input.reviewState)||
  !MUNICIPAL_ELIGIBILITY_STATES.includes(input.eligibilityState))
  return {ok:false,reason:'decisao_invalida'};
 if(input.reviewState==='confirmed_by_reviewer'){
  if(classifyObservation(observation,today)!=='potencialmente_aberta_verificar_fonte')
   return {ok:false,reason:'prazo_ou_evidencia_sem_vigencia'};
  if(input.eligibilityState!=='potential')
   return {ok:false,reason:'enquadramento_indeterminado'};
  if(municipalityOfferCompatibility(observation,municipality).status==='possivel_impedimento')
   return {ok:false,reason:'possivel_impedimento_municipal'};
 }
 if(input.reviewState!=='confirmed_by_reviewer'&&input.eligibilityState==='potential')
  return {ok:false,reason:'nao_concluir_aptidao_sem_documento'};
 return {ok:true,reason:'parecer_humano_declarado_sem_certificacao_externa'};
}
export function summarizeNoticeReviews(reviews){
 const unique=new Map();
 for(const row of reviews){
  if(!unique.has(row.observation_id))unique.set(row.observation_id,row);
 }
 return {
  observationsWithSecondReview:unique.size,
  declaredConfirmed:[...unique.values()].filter(x=>x.review_state==='confirmed_by_reviewer').length,
  independentlyVerifiedByOfficialAuthority:0,
  note:'Pareceres de segundo servidor são declarações municipais; a autoridade concedente não foi consultada nem confirmou automaticamente a elegibilidade.'
 };
}
