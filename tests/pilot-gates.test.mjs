import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT_GATES,isEvidenceUrl,pilotEvidenceSummary} from '../lib/pilot-gates.mjs';
test('V1: critérios operacionais permanecem 0/8 aprovados sem sign-off independente',()=>{
 const latest=PILOT_GATES.map((g,i)=>({
  gate_id:g.id,result_claimed:'pass',environment_label:'Homologação municipal',
  performed_on:'2026-11-07',evidence_url:'https://example.gov.br/auditoria/arquivo-'+i
 }));
 const s=pilotEvidenceSummary(latest);
 assert.equal(s.declaredPass,8);assert.equal(s.independentlyApproved,0);
 assert.equal(s.decision,'NO-GO');
 assert.equal(s.recordedGateCount,8);
});
test('V1: somente URL HTTPS de evidência sem credenciais ou tokens',()=>{
 for(const url of ['http://gov.br/logs/a','https://localhost/private/a',
  'https://user:password@gov.br/a','https://example.gov.br/arquivo?token=secret',
  'https://example.gov.br/','https://127.0.0.1/private'])
  assert.equal(isEvidenceUrl(url),false,url);
 assert.equal(isEvidenceUrl('https://www.gov.br/transferegov/relatorio/fonte'),true);
});
test('V1: gate não listado é desconsiderado',()=>{
 const s=pilotEvidenceSummary([{gate_id:'OP-09',result_claimed:'pass'},
  {gate_id:'OP-01',result_claimed:'blocked',environment_label:'Staging',performed_on:'2026-11-07',
   evidence_url:'https://www.gov.br/portal/auditoria'}]);
 assert.equal(s.recordedGateCount,1);assert.equal(s.declaredPass,0);
});
