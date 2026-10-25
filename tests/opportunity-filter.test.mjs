import test from 'node:test';
import assert from 'node:assert/strict';
import { filterOpportunities } from '../lib/opportunity-filter.mjs';
const data = [
  { title: 'Saúde municipal', provider: 'Ministério A', areas: ['saúde'] },
  { title: 'Escolas', provider: 'Ministério B', areas: ['educação'] },
  { title: 'Transporte', provider: 'Agência C', areas: ['mobilidade'] }
];
test('busca por título sem diferenciar maiúsculas', () => {
  assert.deepEqual(filterOpportunities(data, { query: 'SAÚDE' }), [data[0]]);
});
test('busca pelo órgão', () => {
  assert.deepEqual(filterOpportunities(data, { query: 'ministério b' }), [data[1]]);
});
test('combina texto e área', () => {
  assert.deepEqual(filterOpportunities(data, { query: 'ministério', area: 'educação' }), [data[1]]);
});
test('retorna lista vazia quando não encontra correspondência', () => {
  assert.deepEqual(filterOpportunities(data, { query: 'inexistente' }), []);
});
test('não altera a lista original', () => {
  const before = JSON.stringify(data);
  filterOpportunities(data, { area: 'saúde' });
  assert.equal(JSON.stringify(data), before);
});
