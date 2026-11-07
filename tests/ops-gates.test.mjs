import test from 'node:test';
import assert from 'node:assert/strict';
import {OP_GATES,summarizeOperationGates} from '../lib/ops-gates.mjs';
test('OP-01..08: sem evidência nenhuma porta é aprovada',()=>{
 const r=summarizeOperationGates({gates:Object.fromEntries(OP_GATES.map(k=>[k,{status:'PENDING'}]))});
 assert.equal(r.declaredApproved,0);assert.equal(r.percentage,0);assert.equal(r.decision,'NO-GO');
});
test('OP-01..08: não contar aprovado sem evidência/autor/data',()=>{
 const gates=Object.fromEntries(OP_GATES.map(k=>[k,{status:'APPROVED'}]));
 const r=summarizeOperationGates({gates});
 assert.equal(r.declaredApproved,0);assert.equal(r.decision,'NO-GO');
});
test('OP-01..08: declaração plena ainda exige aprovação externa',()=>{
 const gates=Object.fromEntries(OP_GATES.map(k=>[k,{status:'APPROVED',
  evidence:'TICKET-TEST-'+k,approver:'Equipe responsável',approved_at:'2026-11-07'}]));
 const r=summarizeOperationGates({target:'homologacao-fomento',commit_sha:'a'.repeat(40),
  accepted_by:'Equipe homologadora',gates});
 assert.equal(r.declaredApproved,8);assert.equal(r.percentage,100);
 assert.equal(r.decision,'REQUIRES_MANUAL_GO_APPROVAL');
});
