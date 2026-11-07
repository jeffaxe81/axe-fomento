const RATE_DENOMINATOR = 1_000_000n;

function parseMonthlyRate(value) {
  if (typeof value !== 'string') return null;
  const match = /^([0-9]{1,3})(?:[.,]([0-9]{1,4}))?$/.exec(value);
  if (!match) return null;

  const [, whole, fraction = ''] = match;
  const units = Number(whole) * 10_000 + Number(fraction.padEnd(4, '0'));
  return units <= Number(RATE_DENOMINATOR) ? units : null;
}

function parseMonths(value, min, max) {
  if (typeof value !== 'string' || value.length > String(max).length || !/^[0-9]+$/.test(value)) {
    return null;
  }
  const months = Number(value);
  return months >= min && months <= max ? months : null;
}

export function simulateFinancing(principalCents, input) {
  if (typeof principalCents !== 'string' || !/^[0-9]{1,24}$/.test(principalCents)) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const principal = BigInt(principalCents);
  const monthlyRateUnits = parseMonthlyRate(input.monthlyRate);
  const amortizationMonths = parseMonths(input.amortizationMonths, 1, 360);
  const graceMonths = parseMonths(input.graceMonths, 0, 60);
  if (principal === 0n || monthlyRateUnits === null || amortizationMonths === null || graceMonths === null) {
    return null;
  }

  const rate = BigInt(monthlyRateUnits);
  const term = BigInt(amortizationMonths);
  const baseAmortization = principal / term;
  // Distribute any remaining cents to the first amortization installments.
  const extraCentMonths = Number(principal % term);
  let balance = principal;
  let totalInterest = 0n;
  const installments = [];

  for (let month = 1; month <= graceMonths + amortizationMonths; month++) {
    const amortizationMonth = month - graceMonths;
    const inGrace = amortizationMonth <= 0;
    const openingBalance = balance;
    const amortization = inGrace ? 0n : baseAmortization + (amortizationMonth <= extraCentMonths ? 1n : 0n);
    // Interest is paid each month and rounded half up to the nearest cent.
    const interest = (openingBalance * rate + RATE_DENOMINATOR / 2n) / RATE_DENOMINATOR;
    balance -= amortization;
    totalInterest += interest;

    installments.push({
      month,
      phase: inGrace ? 'grace' : 'amortization',
      openingBalanceCents: openingBalance.toString(),
      amortizationCents: amortization.toString(),
      interestCents: interest.toString(),
      installmentCents: (amortization + interest).toString(),
      balanceCents: balance.toString(),
    });
  }

  return {
    principalCents: principal.toString(),
    monthlyRateUnits,
    amortizationMonths,
    graceMonths,
    gracePaymentCents: graceMonths > 0 ? installments[0].installmentCents : null,
    firstAmortizationPaymentCents: installments[graceMonths].installmentCents,
    lastAmortizationPaymentCents: installments[installments.length - 1].installmentCents,
    totalInterestCents: totalInterest.toString(),
    totalPaidCents: (principal + totalInterest).toString(),
    installments,
  };
}
