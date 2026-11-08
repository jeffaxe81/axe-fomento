import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIndependentNoticeReview,summarizeNoticeReviews} from '../lib/notice-review-policy.mjs';
const today='2026-11-08';
const valid={
 id:'synthetic-1',created_by:'author',source:'other_official',external_code:'EDITAL-2026',
 observation_kind:'oportunidade_conferida',reference_status:'conferida_por_operador',
 opens_on:'2026-11-01',closes_on:'2026-11-25',checked_on:'2026-11-07',
 is_superseded:false,
 terms:{noticeEvidence:{noticeIdentifier:'EDITAL-2026',issuingAgency:'Secretaria de Financiamento',
  noticeUrl:'https://www.gov.br/municipio/edital-publico-2026',publicationDate:'2026-10-28'},
  minimumPopulation:5000}
};
const municipality={population:10000,priority_areas:[]};
const input={reviewState:'confirmed_by_reviewer',eligibilityState:'potential',
 officialDocumentUrl:valid.terms.noticeEvidence.noticeUrl};
test('V1 human review is only a municipal attestation, never external certification',()=>{
 assert.deepEqual(validateIndependentNoticeReview(valid,municipality,'second-admin',input,today),
  {ok:true,reason:'parecer_humano_declarado_sem_certificacao_externa'});
 const summary=summarizeNoticeReviews([{observation_id:'synthetic-1',review_state:'confirmed_by_reviewer'}]);
 assert.equal(summary.declaredConfirmed,1);
 assert.equal(summary.independentlyVerifiedByOfficialAuthority,0);
});
test('V1 rejects self-approval, superseded sources, expired notices, possible municipal impediments',()=>{
 assert.equal(validateIndependentNoticeReview(valid,municipality,'author',input,today).reason,
  'autor_nao_pode_revisar');
 assert.equal(validateIndependentNoticeReview({...valid,is_superseded:true},municipality,'second-admin',input,today).reason,
  'fonte_substituida');
 assert.equal(validateIndependentNoticeReview({...valid,closes_on:'2026-11-07'},municipality,'second-admin',input,today).reason,
  'prazo_ou_evidencia_sem_vigencia');
 assert.equal(validateIndependentNoticeReview(valid,{population:2000,priority_areas:[]},'second-admin',input,today).reason,
  'possivel_impedimento_municipal');
});
test('V1 cannot attest unsupported URL, mismatch, unverified eligibility or incomplete document',()=>{
 assert.equal(validateIndependentNoticeReview(valid,municipality,'second-admin',{...input,
  officialDocumentUrl:'https://www.gov.br/municipio/outro-edital'},today).reason,
  'documento_primario_nao_corresponde');
 assert.equal(validateIndependentNoticeReview({...valid,terms:{}},municipality,'second-admin',input,today).reason,
  'documento_primario_nao_corresponde');
 assert.equal(validateIndependentNoticeReview(valid,municipality,'second-admin',{...input,
  eligibilityState:'undetermined'},today).reason,'enquadramento_indeterminado');
 assert.equal(validateIndependentNoticeReview(valid,municipality,'second-admin',{...input,
  reviewState:'insufficient_evidence'},today).reason,'nao_concluir_aptidao_sem_documento');
});
