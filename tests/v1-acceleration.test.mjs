import test from 'node:test';
import assert from 'node:assert/strict';
import {V1_ACCELERATION,V1_WORKSTREAMS,summarizeV1Acceleration} from '../lib/v1-acceleration.mjs';
import {PRODUCT_VERSIONS,OPERATIONAL_GATES} from '../lib/product-roadmap.mjs';
test('Antecipação real de 30 dias do prazo anterior, sem concluir marcos',()=>{
 const oneDay=24*60*60*1000;
 const before=Date.parse(V1_ACCELERATION.previousTarget+'T00:00:00Z');
 const after=Date.parse(V1_ACCELERATION.newTarget+'T00:00:00Z');
 assert.equal((before-after)/oneDay,30);
 assert.equal(PRODUCT_VERSIONS.find(v=>v.id==='V1').target,V1_ACCELERATION.newTarget);
 assert.deepEqual(summarizeV1Acceleration(PRODUCT_VERSIONS,OPERATIONAL_GATES),{
  coded:6,required:8,percent:75,pendingMilestones:['V1-07','V1-08'],
  operationalApproved:0,operationalRequired:8,operatingDecision:'NO-GO'
 });
});
test('Exatamente dez frentes, prazos coerentes e evidências verificáveis',()=>{
 assert.equal(V1_WORKSTREAMS.length,10);
 assert.equal(new Set(V1_WORKSTREAMS.map(f=>f.id)).size,10);
 for(const f of V1_WORKSTREAMS){
  assert.match(f.id,/^F\d{2}$/);
  assert.ok(Date.parse(f.target+'T00:00:00Z')>=Date.parse(V1_ACCELERATION.decidedOn+'T00:00:00Z'));
  assert.ok(Date.parse(f.target+'T00:00:00Z')<=Date.parse(V1_ACCELERATION.newTarget+'T00:00:00Z'));
  assert.ok(f.title.length>5 && f.deliverable.length>20 && f.evidence.length>20);
  assert.ok(f.blocker.length>10 && Number.isInteger(f.issue));
 }
 assert.equal(V1_WORKSTREAMS.at(-1).target,V1_ACCELERATION.newTarget);
});
test('Documento de antecipação não concede produção por omissão de aceite externo',()=>{
 assert.equal(V1_ACCELERATION.operatingDecision,'NO-GO');
 assert.ok(V1_WORKSTREAMS.some(f=>f.id==='F02'&&f.blocker.includes('vigente')));
 assert.ok(V1_WORKSTREAMS.some(f=>f.id==='F10'&&f.blocker.includes('autorização')));
});
