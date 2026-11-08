import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPilotFieldPacket} from '../lib/v1-field-preflight.mjs';
const today='2026-11-08';
const gates=Array.from({length:8},(_,i)=>({
 id:'e'+i,gate_id:'OP-0'+(i+1),result_claimed:'pass',created_by:'author',
 performed_on:'2026-11-07',environment_label:'Homologação Palhoça SC',
 evidence_url:'https://www.gov.br/piloto/teste-'+i,
 evidence_sha256:'a'.repeat(64)
}));
const reviews=gates.map((e,i)=>({
 evidence_id:e.id,decision:'accepted',reviewed_by:'different-admin',
 acceptance_url:'https://www.gov.br/piloto/aceite-assinado-'+i,
 reviewed_on:'2026-11-08'
}));
test('V1: perfect documentary packet can be audited but never authorizes production',()=>{
 const x=auditPilotFieldPacket({evidence:gates,reviews,today});
 assert.equal(x.completeDocumentaryGates,8);
 assert.equal(x.readyForInstitutionalAudit,true);
 assert.equal(x.fieldVerifiedGates,0);
 assert.equal(x.productionDecision,'NO-GO');
 assert.equal(x.deploymentAuthorized,false);
});
test('V1: evidence from different environments is not one pilot',()=>{
 const changed=gates.map((g,i)=>({...g,environment_label:i===0?'TESTE B':'Teste A'}));
 const x=auditPilotFieldPacket({evidence:changed,reviews,today});
 assert.equal(x.inconsistentEnvironments,true);
 assert.equal(x.completeDocumentaryGates,0);
 assert.ok(x.gateChecks.every(g=>g.issues.includes('ambientes_divergentes')));
});
test('V1: stale and future evidence, missing digest, self-review or older review all block readiness',()=>{
 const variants=[
  {e:{...gates[0],performed_on:'2026-09-01'},reason:'ensaio_fora_da_validade'},
  {e:{...gates[0],performed_on:'2026-11-09'},reason:'ensaio_fora_da_validade'},
  {e:{...gates[0],evidence_sha256:null},reason:'checksum_nao_informado'},
  {r:{...reviews[0],reviewed_by:'author'},reason:'revisao_independente_pendente'},
  {r:{...reviews[0],reviewed_on:'2026-11-06'},reason:'data_de_revisao_invalida'},
  {e:{...gates[0],result_claimed:'blocked'},reason:'ensaio_nao_aprovado'}
 ];
 for(const variant of variants){
  const e=gates.map((g,i)=>i===0&&(variant.e)?variant.e:g);
  const r=reviews.map((v,i)=>i===0&&(variant.r)?variant.r:v);
  const actual=auditPilotFieldPacket({evidence:e,reviews:r,today});
  assert.equal(actual.readyForInstitutionalAudit,false,variant.reason);
  assert.ok(actual.gateChecks[0].issues.includes(variant.reason),variant.reason);
 }
});
test('V1: newest failed attempt replaces older approved attempt; unrecorded gates remain pending',()=>{
 const newer={...gates[0],id:'latest',result_claimed:'fail'};
 const x=auditPilotFieldPacket({evidence:[newer,...gates],reviews,today});
 assert.equal(x.completeDocumentaryGates,7);
 assert.ok(x.gateChecks[0].issues.includes('ensaio_nao_aprovado'));
 const empty=auditPilotFieldPacket({today});
 assert.equal(empty.completeDocumentaryGates,0);
 assert.equal(empty.gateChecks.length,8);
 assert.ok(empty.gateChecks.every(g=>g.issues.includes('evidencia_nao_registrada')));
});
test('V1: rejects invalid reference dates and time policy',()=>{
 assert.throws(()=>auditPilotFieldPacket({today:'2026-02-30'}));
 assert.throws(()=>auditPilotFieldPacket({today,maxAgeDays:0}));
});

test('V1: midnight UTC must not shift the pilot civil date in Brasília',()=>{
 const accepted=auditPilotFieldPacket({evidence:gates,reviews,today:'2026-11-08'});
 assert.equal(accepted.completeDocumentaryGates,8);
});
