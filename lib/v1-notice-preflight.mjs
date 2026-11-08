import {classifyObservation,municipalityOfferCompatibility,validateNoticeEvidence} from './funding-pipeline.mjs';

// F02/F03: checklist municipal antecipado da V1-07.
// Documento e parecer são informados por pessoas; nenhuma chamada à fonte é feita aqui.
export function auditV1NoticeCandidate(observation,municipality,review,today){
 const issues=[];
 if(!observation||!validateNoticeEvidence(observation.terms?.noticeEvidence,today).ok)
  issues.push('documento_individual_pendente');
 if(!observation||classifyObservation(observation,today)!=='potencialmente_aberta_verificar_fonte')
  issues.push('vigencia_nao_comprovada');
 if(observation&&municipalityOfferCompatibility(observation,municipality).status==='possivel_impedimento')
  issues.push('possivel_impedimento_municipal');
 const needsPopulation=observation?.terms?.minimumPopulation!=null||
  observation?.terms?.maximumPopulation!=null;
 if(needsPopulation&&(!Number.isFinite(Number(municipality?.population))||
  Number(municipality?.population)<=0))issues.push('populacao_municipal_nao_informada');
 if(!review||review.review_state!=='confirmed_by_reviewer')
  issues.push('segunda_revisao_pendente');
 if(!review||review.eligibility_state!=='potential')
  issues.push('elegibilidade_municipal_pendente');
 // revisão anterior à consulta, futura ou sem data jamais é atual
 if(review&&(!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewed_on??'')||
  review.reviewed_on>today||review.reviewed_on<(observation?.checked_on??today)))
  issues.push('data_parecer_incoerente');
 return {
  documentaryReadyForExternalAudit:issues.length===0,
  issues,
  officialAuthorityVerified:false,
  productionApproved:false,
  notice:'Pré-verificação de registros municipais, sem consulta oficial automática ou homologação da autoridade concedente.'
 };
}
