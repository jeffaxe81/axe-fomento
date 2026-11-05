import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDeadline, radarReferenceDate } from '../lib/opportunity-deadline.mjs';

const reference = new Date('2026-10-25T15:00:00Z');
test('prazo ausente é explicitamente desconhecido', () => {
  assert.equal(classifyDeadline(null, reference).status, 'nao_informado');
});
test('prazo de hoje permanece válido', () => {
  assert.deepEqual(classifyDeadline('2026-10-25', reference), { status: 'vence_hoje', label: 'Vence hoje', daysRemaining: 0 });
});
test('prazo anterior está encerrado', () => {
  assert.equal(classifyDeadline('2026-10-24', reference).status, 'encerrado');
});
test('prazo futuro indica dias restantes', () => {
  const result = classifyDeadline('2026-10-30', reference);
  assert.equal(result.status, 'aberto');
  assert.equal(result.daysRemaining, 5);
});
test('datas impossíveis não são aceitas', () => {
  assert.equal(classifyDeadline('2026-02-30', reference).status, 'invalido');
  assert.equal(classifyDeadline('25/10/2026', reference).status, 'invalido');
});
test('data de referência inválida gera erro', () => {
  assert.throws(() => classifyDeadline('2026-10-25', new Date('invalid')), TypeError);
});
test('prazo de Brasília só muda quando vira o dia civil local', () => {
  const beforeMidnight = radarReferenceDate(new Date('2026-11-06T02:59:59Z'));
  const afterMidnight = radarReferenceDate(new Date('2026-11-06T03:00:00Z'));
  assert.equal(beforeMidnight.toISOString(), '2026-11-05T00:00:00.000Z');
  assert.equal(afterMidnight.toISOString(), '2026-11-06T00:00:00.000Z');
  assert.equal(classifyDeadline('2026-11-05', beforeMidnight).status, 'vence_hoje');
  assert.equal(classifyDeadline('2026-11-05', afterMidnight).status, 'encerrado');
});
