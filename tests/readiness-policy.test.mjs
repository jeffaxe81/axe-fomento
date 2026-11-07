import test from 'node:test';
import assert from 'node:assert/strict';
import {BASELINE_CRITERIA,BLOCKER_RULES,calculateReadiness,validateBlockers} from '../lib/readiness-policy.mjs';
test('AF-044/045: rubrica oficial do sistema soma 100 e nota determinística',()=>{
 assert.equal(BASELINE_CRITERIA.reduce((s,x)=>s+x.weight,0),100);
 const answers=BASELINE_CRITERIA.map(x=>({id:x.id,score:80,evidence:'Evidência interna descrita para conferência'}));
 const a=calculateReadiness(BASELINE_CRITERIA,answers,[]);
 assert.equal(a.score,80);assert.equal(a.maximumPossibleScore,80);
 assert.deepEqual(a,calculateReadiness(BASELINE_CRITERIA,[...answers].reverse(),[]));
});
test('AF-046/047: bloqueio independe da nota, lacunas têm prioridades',()=>{
 const answers=BASELINE_CRITERIA.map(x=>({id:x.id,score:99,evidence:'Evidência declarada, não auditada'}));
 const result=calculateReadiness(BASELINE_CRITERIA,answers,[{code:'elegibilidade',evidence:'Exigência objetiva a conferir no edital original'}]);
 assert.equal(result.score,99);assert.equal(result.blockers.length,1);
 assert.equal(result.actions[0].priority,'critica');
 const pending=calculateReadiness(BASELINE_CRITERIA,[answers[0]],[]);
 assert.equal(pending.complete,false);assert.ok(pending.actions.some(x=>x.reason.startsWith('Evidência ainda ausente')));
});
test('AF-046: não aceita impedimento sem regra ou evidência',()=>{
 assert.equal(BLOCKER_RULES.length,4);
 assert.throws(()=>validateBlockers([{code:'inexistente',evidence:'Documento da equipe não validado'}]));
 assert.throws(()=>validateBlockers([{code:'documentacao',evidence:'curta'}]));
});
