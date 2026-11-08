export function formatMoney(value: string | null): string {
  if (value === null || !Number.isFinite(Number(value))) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value));
}

const fundingCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatFundingAmount(value: string | null): string {
  const decimal = value?.match(/^(-?\d{1,14})(?:\.(\d{1,2}))?$/);
  if (!decimal) return 'Não informado';
  const [, whole, cents = ''] = decimal;
  // The integer portion of PostgreSQL numeric(16, 2) is exactly representable.
  return fundingCurrency.formatToParts(Number(whole))
    .map((part) => part.type === 'fraction' ? cents.padEnd(2, '0') : part.value)
    .join('');
}

export function formatOpportunityDate(date: string | null): string {
  if (!date) return 'Não informado';
  const day = new Date(date + 'T00:00:00Z');
  return Number.isNaN(day.getTime()) ? 'Não informado' : day.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
