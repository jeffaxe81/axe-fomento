import test from 'node:test';
import assert from 'node:assert/strict';
import {auditV1NoticeCandidate} from '../lib/v1-notice-preflight.mjs';
const today='2026-11-08';
const observation={
 observation_kind:'oportunidade_conferida',reference_status:'conferida_por_operador',
 opens_on:'2026-11-01',closes_on:'2026-11-25',checked_on:'2026-11-07',
 terms:{minimumPopulation:5000,noticeEvidence:{
  noticeIdentifier:'EDITAL-2026',issuingAgency:'Secretaria de Fomento',
  noticeUrl:'https://www.gov.br/ministerio/edital-2026',publicationDate:'2026-10-28'
 }}
};
const municipality={population:10000,priority_areas:[]};
const review={review_state:'confirmed_by_reviewer',eligibility_state:'potential',reviewed_on:'2026-11-08'};
test('pré-verificação completa é apenas documentação para auditoria e nunca GO',()=>{
 const a=auditV1NoticeCandidate(observation,municipality,review,today);
 assert.deepEqual(a.issues,[]);
 assert.equal(a.documentaryReadyForExternalAudit,true);
 assert.equal(a.officialAuthorityVerified,false);
 assert.equal(a.productionApproved,false);
});
test('edital sem revisão, vencido e sem documentação nunca é liberado',()=>{
 const a=auditV1NoticeCandidate({...observation,
  closes_on:'2026-11-07',terms:{}},municipality,null,today);
 assert.equal(a.documentaryReadyForExternalAudit,false);
 assert.ok(a.issues.includes('documento_individual_pendente'));
 assert.ok(a.issues.includes('vigencia_nao_comprovada'));
 assert.ok(a.issues.includes('segunda_revisao_pendente'));
});
test('impedimento populacional ou cadastro vazio impede preparo para auditoria',()=>{
 const low=auditV1NoticeCandidate(observation,{population:1000,priority_areas:[]},review,today);
 assert.ok(low.issues.includes('possivel_impedimento_municipal'));
 const noPop=auditV1NoticeCandidate(observation,{population:null,priority_areas:[]},review,today);
 assert.ok(noPop.issues.includes('populacao_municipal_nao_informada'));
});
test('revisão futura ou anterior à consulta não conta como parecer coerente',()=>{
 for(const reviewed_on of ['2026-11-09','2026-11-01']){
  const a=auditV1NoticeCandidate(observation,municipality,{...review,reviewed_on},today);
  assert.ok(a.issues.includes('data_parecer_incoerente'));
 }
});
