import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProjects } from '../lib/project-summary.mjs';
test('retorna zeros quando não há projetos', () => {
  assert.deepEqual(summarizeProjects([]), { total: 0, byStatus: { rascunho: 0, preparacao: 0, submetido: 0, aprovado: 0, recusado: 0 } });
});
test('conta os projetos por status', () => {
  const result = summarizeProjects([{ status: 'rascunho' }, { status: 'submetido' }, { status: 'rascunho' }]);
  assert.equal(result.total, 3);
  assert.equal(result.byStatus.rascunho, 2);
  assert.equal(result.byStatus.submetido, 1);
});
test('rejeita status não reconhecido', () => {
  assert.throws(() => summarizeProjects([{ status: 'apagado' }]), RangeError);
});
test('rejeita lista inválida', () => {
  assert.throws(() => summarizeProjects(null), TypeError);
});
