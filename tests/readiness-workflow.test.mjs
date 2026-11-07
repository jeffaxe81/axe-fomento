import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBlockers,planForGaps,simulateReadiness} from '../lib/readiness-workflow.mjs';
const rubric=[{id:'demanda',label:'Demanda identificada',weight:60},{id:'custos',label:'Custos e premissas',weight:40}];
test('AF-046/047: impedimento confirmado não é absorvido pela nota',()=>{
 const blockers=validateBlockers([{id:'legal',title:'Limitação legal citada',ruleUrl:'https://www.gov.br/planejamento',evidence:'Documento interno indicando necessidade de conferência normativa.',confirmed:true}]);
 const actions=planForGaps({breakdown:[{id:'demanda',label:'Demanda identificada',score:90},{id:'custos',label:'Custos e premissas',score:null}]},blockers);
 assert.equal(actions[0].priority,'critica');assert.equal(actions[1].priority,'alta');
 assert.throws(()=>validateBlockers([{...blockers[0],ruleUrl:'http://localhost'}]));
});
test('AF-048: simulação não altera nota registrada e explicita premissas',()=>{
 const original=[{id:'demanda',score:50,evidence:'Pesquisa de campo inicial'},{id:'custos',score:null,evidence:null}];
 const before=structuredClone(original);
 const result=simulateReadiness(rubric,original,[{id:'custos',score:100,evidence:'Orçamento estimativo declarado'}]);
 assert.equal(result.current.score,30);assert.equal(result.hypothetical.score,70);assert.equal(result.delta,40);
 assert.deepEqual(original,before);
 assert.throws(()=>simulateReadiness(rubric,original,[{id:'outro',score:80,evidence:'Fonte pública'}]));
});
