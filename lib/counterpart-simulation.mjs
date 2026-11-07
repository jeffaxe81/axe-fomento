import { parseBRLToCents } from './financial-money.mjs';

function parseRateBasisPoints(value) {
  if (typeof value !== 'string') return null;
  const match = /^([0-9]+)(?:[.,]([0-9]{1,2}))?$/.exec(value.trim());
  if (!match) return null;

  const [, whole, fraction = ''] = match;
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return basisPoints <= 10000 ? basisPoints : null;
}

// Arithmetic for planning only. Monetary values are returned as JSON-safe strings.
export function simulateCounterpart(totalCents, percent, availableBudget) {
  if (typeof totalCents !== 'string' || !/^[0-9]+$/.test(totalCents)) return null;
  const rateBasisPoints = parseRateBasisPoints(percent);
  const availableCents = typeof availableBudget === 'string'
    ? parseBRLToCents(availableBudget.trim())
    : null;
  if (rateBasisPoints === null || availableCents === null) return null;

  const total = BigInt(totalCents);
  const municipal = (total * BigInt(rateBasisPoints) + 5000n) / 10000n;
  const balance = BigInt(availableCents) - municipal;

  return {
    totalCents: total.toString(),
    rateBasisPoints,
    municipalCents: municipal.toString(),
    remainingProjectCents: (total - municipal).toString(),
    availableCents,
    shortageCents: balance < 0n ? (-balance).toString() : '0',
    surplusCents: balance > 0n ? balance.toString() : '0',
  };
}
