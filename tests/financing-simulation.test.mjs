import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateFinancing } from '../lib/financing-simulation.mjs';

function terms(monthlyRate, amortizationMonths, graceMonths) {
  return { monthlyRate, amortizationMonths, graceMonths };
}

function installment(month, phase, openingBalanceCents, amortizationCents, interestCents, installmentCents, balanceCents) {
  return { month, phase, openingBalanceCents, amortizationCents, interestCents, installmentCents, balanceCents };
}

test('AF-027: reproduz o cenário A e a memória mensal do plano', () => {
  assert.deepEqual(simulateFinancing('120000', terms('2', '3', '1')), {
    principalCents: '120000',
    monthlyRateUnits: 20000,
    amortizationMonths: 3,
    graceMonths: 1,
    gracePaymentCents: '2400',
    firstAmortizationPaymentCents: '42400',
    lastAmortizationPaymentCents: '40800',
    totalInterestCents: '7200',
    totalPaidCents: '127200',
    installments: [
      installment(1, 'grace', '120000', '0', '2400', '2400', '120000'),
      installment(2, 'amortization', '120000', '40000', '2400', '42400', '80000'),
      installment(3, 'amortization', '80000', '40000', '1600', '41600', '40000'),
      installment(4, 'amortization', '40000', '40000', '800', '40800', '0'),
    ],
  });
});

test('AF-027: reproduz o cenário B e a memória mensal do plano', () => {
  assert.deepEqual(simulateFinancing('120000', terms('1', '4', '0')), {
    principalCents: '120000',
    monthlyRateUnits: 10000,
    amortizationMonths: 4,
    graceMonths: 0,
    gracePaymentCents: null,
    firstAmortizationPaymentCents: '31200',
    lastAmortizationPaymentCents: '30300',
    totalInterestCents: '3000',
    totalPaidCents: '123000',
    installments: [
      installment(1, 'amortization', '120000', '30000', '1200', '31200', '90000'),
      installment(2, 'amortization', '90000', '30000', '900', '30900', '60000'),
      installment(3, 'amortization', '60000', '30000', '600', '30600', '30000'),
      installment(4, 'amortization', '30000', '30000', '300', '30300', '0'),
    ],
  });
});

test('AF-027: paga os juros em cada mês de carência sem capitalizar ou amortizar', () => {
  const result = simulateFinancing('1000', terms('2', '1', '3'));

  assert.deepEqual(result.installments, [
    installment(1, 'grace', '1000', '0', '20', '20', '1000'),
    installment(2, 'grace', '1000', '0', '20', '20', '1000'),
    installment(3, 'grace', '1000', '0', '20', '20', '1000'),
    installment(4, 'amortization', '1000', '1000', '20', '1020', '0'),
  ]);
  assert.equal(result.gracePaymentCents, '20');
  assert.equal(result.totalInterestCents, '80');
  assert.equal(result.totalPaidCents, '1080');
});

test('AF-027: distribui os centavos residuais nas primeiras amortizações', () => {
  const result = simulateFinancing('101', terms('1', '3', '0'));

  assert.deepEqual(result.installments, [
    installment(1, 'amortization', '101', '34', '1', '35', '67'),
    installment(2, 'amortization', '67', '34', '1', '35', '33'),
    installment(3, 'amortization', '33', '33', '0', '33', '0'),
  ]);
  assert.equal(result.totalPaidCents, '103');
});

test('AF-027: arredonda meio centavo para cima em cada mês', () => {
  const below = simulateFinancing('1', terms('49.9999', '1', '2'));
  assert.equal(below.monthlyRateUnits, 499999);
  assert.deepEqual(below.installments.map(({ interestCents }) => interestCents), ['0', '0', '0']);
  assert.equal(below.totalPaidCents, '1');

  const half = simulateFinancing('1', terms('50', '1', '2'));
  assert.deepEqual(half.installments.map(({ interestCents }) => interestCents), ['1', '1', '1']);
  assert.equal(half.totalInterestCents, '3');
  assert.equal(half.totalPaidCents, '4');
});

test('AF-027: aceita taxa zero e mantém as parcelas da carência em zero', () => {
  const withoutGrace = simulateFinancing('5', terms('0', '2', '0'));
  assert.equal(withoutGrace.gracePaymentCents, null);
  assert.deepEqual(withoutGrace.installments, [
    installment(1, 'amortization', '5', '3', '0', '3', '2'),
    installment(2, 'amortization', '2', '2', '0', '2', '0'),
  ]);

  const withGrace = simulateFinancing('5', terms('0.0000', '2', '2'));
  assert.equal(withGrace.monthlyRateUnits, 0);
  assert.equal(withGrace.gracePaymentCents, '0');
  assert.deepEqual(withGrace.installments, [
    installment(1, 'grace', '5', '0', '0', '0', '5'),
    installment(2, 'grace', '5', '0', '0', '0', '5'),
    installment(3, 'amortization', '5', '3', '0', '3', '2'),
    installment(4, 'amortization', '2', '2', '0', '2', '0'),
  ]);

  for (const result of [withoutGrace, withGrace]) {
    assert.equal(result.totalInterestCents, '0');
    assert.equal(result.totalPaidCents, '5');
  }
});

test('AF-027: mantém os centavos exatos acima do maior inteiro seguro', () => {
  assert.deepEqual(simulateFinancing('9007199254740993', terms('50', '2', '0')), {
    principalCents: '9007199254740993',
    monthlyRateUnits: 500000,
    amortizationMonths: 2,
    graceMonths: 0,
    gracePaymentCents: null,
    firstAmortizationPaymentCents: '9007199254740994',
    lastAmortizationPaymentCents: '6755399441055744',
    totalInterestCents: '6755399441055745',
    totalPaidCents: '15762598695796738',
    installments: [
      installment(1, 'amortization', '9007199254740993', '4503599627370497', '4503599627370497', '9007199254740994', '4503599627370496'),
      installment(2, 'amortization', '4503599627370496', '4503599627370496', '2251799813685248', '6755399441055744', '0'),
    ],
  });
});

test('AF-027: aceita os limites de principal, taxa e prazos', () => {
  const principalCents = '999999999999999999999999';
  const maxRate = simulateFinancing(principalCents, terms('100.0000', '1', '0'));
  assert.equal(maxRate.monthlyRateUnits, 1000000);
  assert.equal(maxRate.totalInterestCents, principalCents);
  assert.equal(maxRate.totalPaidCents, '1999999999999999999999998');

  const maxTerm = simulateFinancing('360', terms('100', '360', '60'));
  assert.equal(maxTerm.installments.length, 420);
  assert.deepEqual(maxTerm.installments[59], installment(60, 'grace', '360', '0', '360', '360', '360'));
  assert.deepEqual(maxTerm.installments[60], installment(61, 'amortization', '360', '1', '360', '361', '359'));
  assert.deepEqual(maxTerm.installments[419], installment(420, 'amortization', '1', '1', '1', '2', '0'));
  assert.equal(maxTerm.totalInterestCents, '86580');
  assert.equal(maxTerm.totalPaidCents, '86940');
});

test('AF-027: rejeita principal malformado ou fora dos limites', () => {
  const validTerms = terms('1', '1', '0');
  for (const principalCents of [
    null, 100, '', '0', '-1', '+1', '1.0', '1,0', '1e3', '0x10', '1 00',
    '1000000000000000000000000',
  ]) {
    assert.equal(simulateFinancing(principalCents, validTerms), null, JSON.stringify(principalCents));
  }
});

test('AF-027: rejeita parâmetros malformados ou fora dos limites', () => {
  const validTerms = terms('1', '1', '0');
  const invalidValues = {
    monthlyRate: [null, 1, '', '-0.0001', '+1', '1e1', '0x10', '2%', '1.', '1.00001', '1.234,5', '100.0001'],
    amortizationMonths: [null, 1, '', '0', '-1', '+1', '1.5', '1e1', '0x10', '361'],
    graceMonths: [null, 1, '', '-1', '+1', '1.5', '1e1', '0x10', '61'],
  };
  for (const [field, values] of Object.entries(invalidValues)) {
    for (const value of values) {
      assert.equal(simulateFinancing('100', { ...validTerms, [field]: value }), null, `${field}: ${JSON.stringify(value)}`);
    }
  }
  assert.equal(simulateFinancing('100', {}), null);
  assert.equal(simulateFinancing('100', null), null);
});

test('AF-027: reconcilia os saldos e totais em diferentes prazos e taxas', () => {
  for (const [principalCents, input] of [
    ['1', terms('0.0001', '6', '0')],
    ['10001', terms('1.2345', '7', '2')],
    ['79258363', terms('99.9999', '120', '30')],
    ['123456789012345678901234', terms('3.1019', '360', '60')],
  ]) {
    const result = simulateFinancing(principalCents, input);
    assert.ok(result, JSON.stringify({ principalCents, ...input }));
    let balance = BigInt(principalCents);
    let totalInterest = 0n;
    let totalPaid = 0n;
    assert.equal(result.installments.length, Number(input.amortizationMonths) + Number(input.graceMonths));
    for (const [index, row] of result.installments.entries()) {
      const amortization = BigInt(row.amortizationCents);
      const interest = BigInt(row.interestCents);
      const payment = BigInt(row.installmentCents);
      assert.equal(row.month, index + 1);
      assert.equal(row.phase, index < Number(input.graceMonths) ? 'grace' : 'amortization');
      assert.equal(BigInt(row.openingBalanceCents), balance);
      assert.ok(amortization >= 0n && amortization <= balance);
      assert.ok(interest >= 0n);
      assert.equal(payment, amortization + interest);

      balance -= amortization;
      assert.equal(BigInt(row.balanceCents), balance);
      totalInterest += interest;
      totalPaid += payment;
    }
    assert.equal(balance, 0n);
    assert.equal(result.totalInterestCents, String(totalInterest));
    assert.equal(result.totalPaidCents, String(totalPaid));
    assert.equal(totalPaid, BigInt(principalCents) + totalInterest);
  }
});
