import test from 'node:test';
import assert from 'node:assert/strict';
import { projectsToCsv } from '../lib/project-csv.mjs';

test('exporta cabeçalho e linhas de projetos', () => {
  const csv = projectsToCsv([{ id: '1', title: 'Projeto', status: 'rascunho', created_at: '2026-10-27' }]);
  assert.ok(csv.startsWith('\uFEFFid,title,status,created_at\r\n'));
  assert.ok(csv.includes('"1","Projeto","rascunho","2026-10-27"'));
});
test('escapa aspas e preserva vírgulas e quebras de linha', () => {
  const csv = projectsToCsv([{ title: 'Saúde, "mais"\nserviços' }]);
  assert.ok(csv.includes('"Saúde, ""mais""\nserviços"'));
});
test('neutraliza fórmulas de planilhas', () => {
  for (const title of ['=1+1', '+cmd', '-1+2', '@SUM(1)', '  =A1', '\t=1+1']) {
    assert.ok(projectsToCsv([{ title }]).includes('"' + "'" + title + '"'));
  }
});
test('exporta lista vazia com cabeçalho', () => {
  assert.equal(projectsToCsv([]), '\uFEFFid,title,status,created_at\r\n');
});
test('rejeita entrada inválida', () => {
  assert.throws(() => projectsToCsv(null), TypeError);
});
