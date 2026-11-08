import test from 'node:test';
import assert from 'node:assert/strict';
import {CODED_SCOPE,OPERATIONAL_GATES,PRODUCT_VERSIONS,VERSION_SUMMARY,PRODUCT_SUMMARY} from '../lib/product-roadmap.mjs';
test('Progresso V1..V4 é uma contagem auditável, distinta do backlog e do GO operacional',()=>{
 assert.equal(PRODUCT_VERSIONS.length,4);
 assert.deepEqual(PRODUCT_VERSIONS.map(v=>VERSION_SUMMARY(v).total),[8,6,5,5]);
 assert.deepEqual(PRODUCT_VERSIONS.map(v=>VERSION_SUMMARY(v).completed),[6,2,1,2]);
 assert.deepEqual(PRODUCT_SUMMARY(),{completed:11,total:24,percent:46});
 assert.deepEqual(CODED_SCOPE,{implemented:65,total:65});
 assert.deepEqual({approved:OPERATIONAL_GATES.approved,total:OPERATIONAL_GATES.total},{approved:0,total:8});
});
test('Cada marco possui nome único, evidência e entrega não aprovada não ganha pontuação',()=>{
 const milestones=PRODUCT_VERSIONS.flatMap(v=>v.milestones);
 assert.equal(new Set(milestones.map(m=>m.id)).size,milestones.length);
 for(const m of milestones){assert.ok(m.evidence?.length>12);assert.ok(m.name?.length>15);assert.equal(typeof m.done,'boolean');}
 for(const v of PRODUCT_VERSIONS){
  assert.ok(Date.parse(v.start+'T00:00:00Z')<Date.parse(v.target+'T00:00:00Z'));
  assert.ok(VERSION_SUMMARY(v).percent<100);
 }
});
