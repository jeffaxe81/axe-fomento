import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildV1AcceptanceReport,V1_ACCEPTANCE_REPORT_VERSION} from '../lib/v1-acceptance-report.mjs';
const exportedAt='2026-11-08T12:00:00.000Z';
const one={id:'e1',gate_id:'OP-01',result_claimed:'pass',created_by:'author',
 performed_on:'2026-11-07',evidence_sha256:'a'.repeat(64)};
const review={evidence_id:'e1',reviewed_by:'another',
 decision:'accepted',acceptance_url:'https://www.gov.br/piloto/aceite-assinado'};
test('V1 report cannot authorize production even with internal eight-gate approval',()=>{
 const gates=Array.from({length:8},(_,i)=>({...one,id:'e'+(i+1),
  gate_id:'OP-0'+(i+1)}));
 const reviews=gates.map((g,i)=>({...review,evidence_id:g.id,
  acceptance_url:'https://www.gov.br/piloto/aceite-assinado-'+i}));
 const {report,sha256}=buildV1AcceptanceReport({municipalityId:'muni-1',exportedAt,
  pilotEvidence:gates,pilotReviews:reviews});
 assert.equal(report.format,V1_ACCEPTANCE_REPORT_VERSION);
 assert.equal(report.operationalPilot.internallyReviewedGates,8);
 assert.equal(report.operationalPilot.fieldApprovedGates,0);
 assert.equal(report.acceptance.productionDecision,'NO-GO');
 assert.equal(report.operationalPilot.documentaryPreflight.readyForInstitutionalAudit,false);
 assert.equal(report.acceptance.deploymentAuthorized,false);
 assert.equal(createHash('sha256').update(JSON.stringify(report)).digest('hex'),sha256);
});
test('V1 report deliberately omits freeform notes and does not auto-verify official APIs',()=>{
 const values={municipalityId:'muni-2',exportedAt,
  sourceChecks:[{source:'parcerias',checked_at:exportedAt,result:'documented',
   route_count:12,schema_digest:'b'.repeat(64),message:'SERVER SECRET'}],
  observations:[{id:'notice1',source:'transferegov',external_code:'notice-cod',
   observation_kind:'oportunidade_conferida',reference_status:'conferida_por_operador',
   checked_on:'2026-11-07',closes_on:'2026-11-30',
   terms:{noticeEvidence:{noticeUrl:'https://www.gov.br/municipio/edital-1'}}}],
  noticeReviews:[{observation_id:'notice1',review_state:'confirmed_by_reviewer',
   eligibility_state:'potential',reason:'SENSITIVE NOTE'}],
  pilotEvidence:[{...one,notes:'PROTECTED INFORMATION'}],pilotReviews:[review]};
 const a=buildV1AcceptanceReport(values),b=buildV1AcceptanceReport(values);
 assert.equal(a.sha256,b.sha256);
 assert.equal(a.report.publicSourceContracts[0].verifiesLiveNotice,false);
 assert.equal(a.report.noticeReview.authorityValidatedCount,0);
 assert.equal(a.report.noticeReview.positiveMunicipalSecondReviews,1);
 assert.ok(!JSON.stringify(a.report).includes('SERVER SECRET'));
 assert.ok(!JSON.stringify(a.report).includes('SENSITIVE NOTE'));
 assert.ok(!JSON.stringify(a.report).includes('PROTECTED INFORMATION'));
});
test('V1 report without field data remains NO-GO and enumerates all OP gates',()=>{
 const {report}=buildV1AcceptanceReport({municipalityId:'muni-3',exportedAt});
 assert.equal(report.operationalPilot.gates.length,8);
 assert.equal(report.operationalPilot.declaredEvidenceGates,0);
 assert.equal(report.operationalPilot.documentaryPreflight.completeDocumentaryGates,0);
 assert.equal(report.operationalPilot.internallyReviewedGates,0);
 assert.equal(report.acceptance.V1_07,'PENDING_EXTERNAL_SOURCE_VALIDATION');
 assert.equal(report.acceptance.V1_08,'PENDING_FIELD_PILOT_AND_INSTITUTIONAL_APPROVAL');
});
