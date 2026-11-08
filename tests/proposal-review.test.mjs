import test from 'node:test';
import assert from 'node:assert/strict';
import {PROPOSAL_REVIEW_DECISIONS,proposalApprovalBlockers} from '../lib/proposal-review.mjs';

test('AF-033: somente decisão humana interna e sem extrapolar homologação',()=>{
 assert.deepEqual(PROPOSAL_REVIEW_DECISIONS.map(x=>x[0]),['aprovada','devolvida']);
 assert.equal(PROPOSAL_REVIEW_DECISIONS[0][1].includes('interna'),true);
});
test('AF-033: marcador de informação não validada impede aprovação editorial',()=>{
 assert.deepEqual(proposalApprovalBlockers(null),['versao']);
 assert.deepEqual(proposalApprovalBlockers({sections:{summary:'[PREENCHER E VALIDAR PELA EQUIPE MUNICIPAL]'}}),
 ['marcadores_pendentes']);
 assert.deepEqual(proposalApprovalBlockers({sections:{summary:'Diagnóstico municipal documentado.'}}),[]);
});
