import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateCounterpart } from '../lib/counterpart-simulation.mjs';

test('AF-026: calcula aporte e falta a partir da taxa com vírgula', () => {
  assert.deepEqual(simulateCounterpart('10000', ' 12,50 ', ' 10,00 '), {
    totalCents: '10000',
    rateBasisPoints: 1250,
    municipalCents: '1250',
    remainingProjectCents: '8750',
    availableCents: '1000',
    shortageCents: '250',
    surplusCents: '0',
  });
});

test('AF-026: aceita taxas de 0% e 100%, incluindo disponibilidade igual ao aporte', () => {
  assert.deepEqual(simulateCounterpart('701', '0', '1.23'), {
    totalCents: '701',
    rateBasisPoints: 0,
    municipalCents: '0',
    remainingProjectCents: '701',
    availableCents: '123',
    shortageCents: '0',
    surplusCents: '123',
  });
  assert.deepEqual(simulateCounterpart('701', '100.00', '7,01'), {
    totalCents: '701',
    rateBasisPoints: 10000,
    municipalCents: '701',
    remainingProjectCents: '0',
    availableCents: '701',
    shortageCents: '0',
    surplusCents: '0',
  });
});

test('AF-026: arredonda meio centavo para cima', () => {
  assert.equal(simulateCounterpart('1', '49.99', '0').municipalCents, '0');
  const result = simulateCounterpart('1', '50', '0');
  assert.equal(result.municipalCents, '1');
  assert.equal(result.remainingProjectCents, '0');
  assert.equal(result.shortageCents, '1');
});

test('AF-026: mantém precisão acima do maior inteiro seguro e produz JSON', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(
    simulateCounterpart('9007199254740993', '50', '999999999999,99'),
  )), {
    totalCents: '9007199254740993',
    rateBasisPoints: 5000,
    municipalCents: '4503599627370497',
    remainingProjectCents: '4503599627370496',
    availableCents: '99999999999999',
    shortageCents: '4403599627370498',
    surplusCents: '0',
  });
});

test('AF-026: retorna null para entradas malformadas ou fora dos limites', () => {
  for (const total of [null, 100, '', '-1', '+1', '1.00', '1e3', '0x10', '1 00']) {
    assert.equal(simulateCounterpart(total, '1', '0'), null, String(total));
  }
  for (const rate of [null, 10, '', '-1', '+1', '100,01', '101', '0.001', '1,234', '1.234,56', '1e1', '25%', '2.']) {
    assert.equal(simulateCounterpart('100', rate, '0'), null, String(rate));
  }
  for (const available of [null, 10, '', '-1', '1.234,56', '12,345', '1000000000000', 'R$ 1,00']) {
    assert.equal(simulateCounterpart('100', '1', available), null, String(available));
  }
});
