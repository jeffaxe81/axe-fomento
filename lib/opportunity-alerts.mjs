import { classifyDeadline } from './opportunity-deadline.mjs';
/** Gera candidatos a alerta. Envio e deduplicação persistente cabem ao serviço autorizado. */
export function buildDeadlineAlerts(opportunities, { thresholdDays = 7, referenceDate = new Date() } = {}) {
  if (!Array.isArray(opportunities)) throw new TypeError('Lista de oportunidades inválida');
  if (!Number.isInteger(thresholdDays) || thresholdDays < 0 || thresholdDays > 365) throw new RangeError('Janela de alerta inválida');
  return opportunities.flatMap(opportunity => {
    const deadline = classifyDeadline(opportunity?.deadline, referenceDate);
    if (!['aberto', 'vence_hoje'].includes(deadline.status) || deadline.daysRemaining > thresholdDays) return [];
    return [{ opportunityId: opportunity.id, title: String(opportunity.title ?? ''), deadline: opportunity.deadline, daysRemaining: deadline.daysRemaining }];
  });
}
