import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMatch } from '../lib/match.mjs';
const city = { uf: 'SC', population: 50000, priority_areas: ['saúde', 'educação'] };
const opportunity = { eligible_ufs: [], areas: ['saúde'], deadline: '2099-12-31', min_population: null, max_population: null };
test('pontua aderência às prioridades municipais', () => {
  const result = evaluateMatch(city, opportunity);
  assert.equal(result.score, 70);
  assert.equal(result.eligible, true);
  assert.ok(result.reasons.some(x => x.includes('saúde')));
});
test('bloqueia UF não contemplada', () => {
  const r = evaluateMatch(city, { ...opportunity, eligible_ufs: ['RS'] });
  assert.equal(r.eligible, false);
  assert.equal(r.score, 0);
});
test('bloqueia edital encerrado', () => {
  assert.equal(evaluateMatch(city, { ...opportunity, deadline: '2020-01-01' }).band, 'Encerrada');
});
test('respeita limites populacionais', () => {
  assert.equal(evaluateMatch(city, { ...opportunity, min_population: 100000 }).eligible, false);
  assert.equal(evaluateMatch(city, { ...opportunity, max_population: 10000 }).eligible, false);
});
test('não supõe elegibilidade populacional sem dados', () => {
  const r = evaluateMatch({ ...city, population: null }, { ...opportunity, max_population: 100000 });
  assert.ok(r.score <= 55);
  assert.ok(r.reasons.some(x => x.includes('verificar')));
});
test('limita a pontuação em 100', () => {
  const r = evaluateMatch(city, { ...opportunity, eligible_ufs: ['SC'], areas: ['saúde', 'educação'], min_population: 10000 });
  assert.equal(r.score, 100);
});
