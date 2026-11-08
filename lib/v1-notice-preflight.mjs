import {classifyObservation,municipalityOfferCompatibility,validateNoticeEvidence,validDate} from './funding-pipeline.mjs';

// F02/F03: análise conservadora de registro municipal (nunca consulta uma fonte externa).
// Para chegar a "pronto para auditoria" exigimos vínculo exato, revisão independente,
// documento correspondente, fundamentação, datas coerentes e dados municipais mínimos.
// Não comprova edital vigente, elegibilidade legal nem autoriza produção.
export function auditV1NoticeCandidate(observation,municipality,review,today){
 const issues=[];
 const doc=observation?.terms?.noticeEvidence;
 if(!observation||!validateNoticeEvidence(doc,today).ok)
  issues.push('documento_individual_pendente');
 if(!observation||observation.is_superseded||
  classifyObservation(observation,today)!=='potencialmente_aberta_verificar_fonte')
  issues.push('vigencia_nao_comprovada');
 if(!municipality)issues.push('cadastro_municipal_pendente');
 if(observation&&municipality&&
  municipalityOfferCompatibility(observation,municipality).status==='possivel_impedimento')
  issues.push('possivel_impedimento_municipal');
 const needsPopulation=observation?.terms?.minimumPopulation!=null||
  observation?.terms?.maximumPopulation!=null;
 if(needsPopulation&&(!Number.isFinite(Number(municipality?.population))||
  municipality?.population==null||Number(municipality?.population)<=0))
  issues.push('populacao_municipal_nao_informada');
 if(!review||review.review_state!=='confirmed_by_reviewer')
  issues.push('segunda_revisao_pendente');
 if(!review||review.eligibility_state!=='potential')
  issues.push('elegibilidade_municipal_pendente');
 if(review){
  if(!observation?.id||review.observation_id!==observation.id)
   issues.push('parecer_nao_vinculado_ao_edital');
  if(!review.reviewed_by||!observation?.created_by||
   review.reviewed_by===observation.created_by)
   issues.push('revisor_independente_nao_comprovado');
  if(!doc?.noticeUrl||review.official_document_url!==doc.noticeUrl)
   issues.push('documento_do_parecer_divergente');
  if(typeof review.reason!=='string'||review.reason.trim().length<60||
   typeof review.requirements_note!=='string'||review.requirements_note.trim().length<40)
   issues.push('fundamentacao_documental_incompleta');
  // Não aceitar datas inválidas, futuras ou anteriores à consulta da fonte.
  if(!validDate(review.reviewed_on)||!validDate(today)||
   review.reviewed_on>today||!validDate(observation?.checked_on)||
   review.reviewed_on<observation.checked_on||
   !validDate(doc?.publicationDate)||review.reviewed_on<doc.publicationDate)
   issues.push('data_parecer_incoerente');
 }
 return {
  documentaryReadyForExternalAudit:issues.length===0,
  issues,
  officialAuthorityVerified:false,
  productionApproved:false,
  notice:'Pré-verificação de registros municipais, sem consulta oficial automática ou homologação da autoridade concedente.'
 };
}
