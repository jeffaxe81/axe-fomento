import test from 'node:test';
import assert from 'node:assert/strict';
import {MODALITIES,REVIEW_STATES,modalityLabel,reviewLabel,countReviews} from '../lib/modality-map.mjs';

test('AF-029: modalidades consistentes com checklist e classificação manual',()=>{
 assert.deepEqual(MODALITIES.map(x=>x[0]),
  ['convenio','transferencia','financiamento','cooperacao','outra']);
 assert.deepEqual(REVIEW_STATES.map(x=>x[0]),
  ['pendente','atendido','nao_atendido','nao_aplicavel']);
 assert.equal(modalityLabel('financiamento'),'Financiamento');
 assert.equal(reviewLabel('nao_atendido'),'Não atendido (declarado)');
 assert.equal(reviewLabel('invalid'),'Pendente de avaliação');
});
test('AF-029: resumo não conclui elegibilidade nem apaga pendências',()=>{
 const rows=[{status:'atendido'},{status:'nao_atendido'},{status:'pendente'},
  {status:'nao_aplicavel'},{status:null},{status:'indefinido'}];
 assert.deepEqual(countReviews(rows),
  {pendente:3,atendido:1,nao_atendido:1,nao_aplicavel:1});
 assert.equal(countReviews([]).pendente,0);
});
