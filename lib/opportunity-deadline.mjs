const brasiliaCalendar = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Representa a data civil de Brasília em UTC para cálculos que ignoram o horário. */
export function radarReferenceDate(now = new Date()) {
  const { year, month, day } = Object.fromEntries(
    brasiliaCalendar.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return new Date(year.padStart(4, '0') + '-' + month + '-' + day + 'T00:00:00Z');
}

/** Classificação informativa de prazos, sem presumir elegibilidade jurídica. */
export function classifyDeadline(deadline, referenceDate = new Date()) {
  if (deadline == null || deadline === '') return { status: 'nao_informado', label: 'Prazo não informado', daysRemaining: null };
  if (typeof deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return { status: 'invalido', label: 'Prazo inválido', daysRemaining: null };
  const parsed = new Date(deadline + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== deadline) return { status: 'invalido', label: 'Prazo inválido', daysRemaining: null };
  const now = new Date(referenceDate);
  if (!Number.isFinite(now.getTime())) throw new TypeError('Data de referência inválida');
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysRemaining = Math.round((parsed.getTime() - today) / 86400000);
  if (daysRemaining < 0) return { status: 'encerrado', label: 'Prazo encerrado', daysRemaining };
  if (daysRemaining === 0) return { status: 'vence_hoje', label: 'Vence hoje', daysRemaining };
  return { status: 'aberto', label: 'Prazo em aberto', daysRemaining };
}
