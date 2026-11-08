import test from 'node:test';
import assert from 'node:assert/strict';
import {auditV1NoticeCandidate} from '../lib/v1-notice-preflight.mjs';

const today='2026-11-08';
const observation={
 id:'obs-1',created_by:'author-1',
 observation_kind:'oportunidade_conferida',reference_status:'conferida_por_operador',
 opens_on:'2026-11-01',closes_on:'2026-11-25',checked_on:'2026-11-07',
 is_superseded:false,
 terms:{minimumPopulation:5000,noticeEvidence:{
  noticeIdentifier:'EDITAL-2026',issuingAgency:'Secretaria de Fomento',
  noticeUrl:'https://www.gov.br/ministerio/edital-2026',publicationDate:'2026-10-28'
 }}
};
const municipality={population:10000,priority_areas:[]};
const review={
 observation_id:'obs-1',reviewed_by:'reviewer-2',
 review_state:'confirmed_by_reviewer',eligibility_state:'potential',
 reviewed_on:'2026-11-08',
 official_document_url:'https://www.gov.br/ministerio/edital-2026',
 reason:'Documento individual consultado e prazo confirmado no portal de origem em revisão humana.',
 requirements_note:'Requisitos populacionais e administrativos do município confrontados com o edital.'
};
function check(obs=observation,city=municipality,rev=review,date=today){
 return auditV1NoticeCandidate(obs,city,rev,date);
}
test('vínculo correto e segundo parecer documentado habilitam só a análise externa',()=>{
 const result=check();
 assert.deepEqual(result.issues,[]);
 assert.equal(result.documentaryReadyForExternalAudit,true);
 assert.equal(result.officialAuthorityVerified,false);
 assert.equal(result.productionApproved,false);
});
test('falta de documento, edital vencido ou fonte substituída bloqueiam pré-verificação',()=>{
 const expired=check({...observation,closes_on:'2026-11-07'});
 assert.ok(expired.issues.includes('vigencia_nao_comprovada'));
 const superseded=check({...observation,is_superseded:true});
 assert.ok(superseded.issues.includes('vigencia_nao_comprovada'));
 const absent=check({...observation,terms:{}},municipality,null);
 assert.ok(absent.issues.includes('documento_individual_pendente'));
 assert.ok(absent.issues.includes('segunda_revisao_pendente'));
 assert.equal(absent.productionApproved,false);
});
test('município sem população mínima, dados ausentes ou revisão negativa não ficam prontos',()=>{
 assert.ok(check(observation,{population:1000,priority_areas:[]}).issues.includes('possivel_impedimento_municipal'));
 assert.ok(check(observation,{population:null,priority_areas:[]}).issues.includes('populacao_municipal_nao_informada'));
 assert.ok(check(observation,null).issues.includes('cadastro_municipal_pendente'));
 assert.ok(check(observation,municipality,{...review,review_state:'insufficient_evidence',eligibility_state:'undetermined'}).issues.includes('segunda_revisao_pendente'));
});
test('somente parecer vinculado, independente e sobre o mesmo documento passa',()=>{
 for(const rev of [
  {...review,observation_id:'outra-observacao'},
  {...review,reviewed_by:'author-1'},
  {...review,reviewed_by:''},
  {...review,official_document_url:'https://www.gov.br/ministerio/outro-edital'}
 ]){
  const result=check(observation,municipality,rev);
  assert.equal(result.documentaryReadyForExternalAudit,false);
 }
 assert.ok(check(observation,municipality,{...review,observation_id:'wrong'}).issues.includes('parecer_nao_vinculado_ao_edital'));
 assert.ok(check(observation,municipality,{...review,reviewed_by:'author-1'}).issues.includes('revisor_independente_nao_comprovado'));
 assert.ok(check(observation,municipality,{...review,official_document_url:'https://www.gov.br/outro-edital'}).issues.includes('documento_do_parecer_divergente'));
});
test('fundamentação e análise de requisitos são obrigatórias',()=>{
 const result=check(observation,municipality,{...review,reason:'OK',requirements_note:'OK'});
 assert.ok(result.issues.includes('fundamentacao_documental_incompleta'));
 assert.equal(result.documentaryReadyForExternalAudit,false);
});
test('data futura, inexistente, anterior à fonte ou à publicação não passa',()=>{
 for(const date of ['2026-11-09','2026-11-01','2026-02-30','2026-10-01','']){
  const result=check(observation,municipality,{...review,reviewed_on:date});
  assert.ok(result.issues.includes('data_parecer_incoerente'),date);
 }
});
