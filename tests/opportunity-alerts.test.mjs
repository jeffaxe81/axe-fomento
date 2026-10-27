import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeadlineAlerts } from '../lib/opportunity-alerts.mjs';
const now = new Date('2026-10-27T12:00:00Z');
const opportunities = [
  { id: 'a', title: 'Vence hoje', deadline: '2026-10-27' },
  { id: 'b', title: 'Vence em 5 dias', deadline: '2026-11-01' },
  { id: 'c', title: 'Encerrada', deadline: '2026-10-26' },
  { id: 'd', title: 'Sem prazo', deadline: null },
  { id: 'e', title: 'Vence em 20 dias', deadline: '2026-11-16' }
];
test('inclui oportunidades dentro da janela padrão', () => {
  assert.deepEqual(buildDeadlineAlerts(opportunities, { referenceDate: now }).map(x => x.opportunityId), ['a', 'b']);
});
test('janela zero seleciona apenas vencimentos de hoje', () => {
  assert.deepEqual(buildDeadlineAlerts(opportunities, { referenceDate: now, thresholdDays: 0 }).map(x => x.opportunityId), ['a']);
});
test('janela ampliada inclui vencimentos mais distantes', () => {
  assert.deepEqual(buildDeadlineAlerts(opportunities, { referenceDate: now, thresholdDays: 30 }).map(x => x.opportunityId), ['a', 'b', 'e']);
});
test('rejeita janelas inválidas', () => {
  assert.throws(() => buildDeadlineAlerts([], { thresholdDays: -1 }), RangeError);
  assert.throws(() => buildDeadlineAlerts([], { thresholdDays: 366 }), RangeError);
});
test('não altera a lista original', () => {
  const before = JSON.stringify(opportunities);
  buildDeadlineAlerts(opportunities, { referenceDate: now });
  assert.equal(JSON.stringify(opportunities), before);
});
