export function formatMoney(value: string | null): string {
  if (value === null || !Number.isFinite(Number(value))) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value));
}
