import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionProject, transitionProjectStatus } from '../lib/project-status.mjs';
test('rascunho pode iniciar preparação', () => assert.equal(transitionProjectStatus('rascunho', 'preparacao'), 'preparacao'));
test('preparação pode voltar a rascunho', () => assert.equal(transitionProjectStatus('preparacao', 'rascunho'), 'rascunho'));
test('preparação pode ser submetida', () => assert.equal(transitionProjectStatus('preparacao', 'submetido'), 'submetido'));
test('submetido pode ser aprovado ou recusado', () => {
  assert.equal(canTransitionProject('submetido', 'aprovado'), true);
  assert.equal(canTransitionProject('submetido', 'recusado'), true);
});
test('não permite pular preparação', () => assert.throws(() => transitionProjectStatus('rascunho', 'aprovado'), RangeError));
test('não permite alterar status terminal', () => assert.throws(() => transitionProjectStatus('aprovado', 'rascunho'), RangeError));
test('não permite transição para o mesmo status', () => assert.equal(canTransitionProject('submetido', 'submetido'), false));
test('rejeita status desconhecido', () => assert.throws(() => transitionProjectStatus('invalido', 'aprovado'), RangeError));
