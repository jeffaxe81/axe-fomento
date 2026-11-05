import 'server-only';
import { z } from 'zod';
import { queryForMunicipality, type Opportunity } from '@/lib/db';

type SearchValue = string | string[] | undefined;
export type RadarFilters = { busca?: SearchValue; area?: SearchValue };
export type ComparisonParams = RadarFilters & { id?: SearchValue };
export type AgendaParams = { dias?: SearchValue; pagina?: SearchValue };

const opportunityId = z.string().uuid();
const columns = "id, title, provider, to_char(deadline, 'YYYY-MM-DD') AS deadline, is_example";
const agendaPageSize = 25;
export const agendaPeriods = [7, 30, 90] as const;

type DeadlineOpportunity = Pick<Opportunity, 'id' | 'title' | 'provider' | 'deadline'> & { is_example: boolean };
type ComparedOpportunity = DeadlineOpportunity & Pick<Opportunity, 'areas' | 'eligible_ufs' | 'funding_amount'>;

function firstValue(value: SearchValue) {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export function radarFilters(params: RadarFilters) {
  return {
    search: firstValue(params.busca).trim().slice(0, 120),
    area: firstValue(params.area).trim().slice(0, 60),
  };
}

export function radarHref({ search, area }: ReturnType<typeof radarFilters>) {
  const query = new URLSearchParams();
  if (search) query.set('busca', search);
  if (area) query.set('area', area);
  return query.size ? '/oportunidades?' + query.toString() : '/oportunidades';
}

export function comparisonIds(value: SearchValue) {
  const selection = typeof value === 'string' ? [value] : value ?? [];
  if (selection.length < 2 || selection.length > 3) return null;

  const ids = selection.map((id) => id.toLowerCase());
  if (new Set(ids).size !== ids.length || !ids.every((id) => opportunityId.safeParse(id).success)) return null;
  return ids;
}

export function agendaSelection(params: AgendaParams) {
  const days = firstValue(params.dias);
  const period = agendaPeriods.find((option) => String(option) === days) ?? 30;
  const rawPage = firstValue(params.pagina);
  const page = /^[1-9]\d{0,8}$/.test(rawPage) ? Number(rawPage) : 1;
  return { period, page };
}

export async function getComparisonOpportunities(municipalityId: string, ids: string[]) {
  return queryForMunicipality<ComparedOpportunity>(
    municipalityId,
    'SELECT ' + columns + ', funding_amount, areas, eligible_ufs FROM opportunities ' +
      'WHERE id = ANY($1::uuid[]) ORDER BY array_position($1::uuid[], id)',
    [ids],
  );
}

export async function listAgendaOpportunities(
  municipalityId: string,
  day: string,
  { period, page }: ReturnType<typeof agendaSelection>,
) {
  const rows = await queryForMunicipality<DeadlineOpportunity>(
    municipalityId,
    'SELECT ' + columns + ' FROM opportunities ' +
      'WHERE deadline BETWEEN $1::date AND $1::date + $2::integer ' +
      'ORDER BY opportunities.deadline, title, id LIMIT $3 OFFSET $4',
    [day, period, agendaPageSize + 1, (page - 1) * agendaPageSize],
  );
  return { opportunities: rows.slice(0, agendaPageSize), hasNext: rows.length > agendaPageSize };
}
