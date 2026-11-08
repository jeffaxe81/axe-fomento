import 'server-only';
import { z } from 'zod';
import { queryForMunicipality, type Opportunity } from '@/lib/db';

type SearchValue = string | string[] | undefined;
export type RadarFilters = { busca?: SearchValue; area?: SearchValue; pagina?: SearchValue };
export type ComparisonParams = RadarFilters & { id?: SearchValue };
export type AgendaParams = { dias?: SearchValue; pagina?: SearchValue };

const opportunityId = z.string().uuid();
const columns = "id, title, provider, to_char(deadline, 'YYYY-MM-DD') AS deadline, is_example";
const radarPageSize = 25;
const agendaPageSize = 25;
export const agendaPeriods = [7, 30, 90] as const;

type DeadlineOpportunity = Pick<Opportunity, 'id' | 'title' | 'provider' | 'deadline'> & { is_example: boolean };
type ComparedOpportunity = DeadlineOpportunity & Pick<Opportunity, 'areas' | 'eligible_ufs' | 'funding_amount'>;

function firstValue(value: SearchValue) {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export function radarFilters(params: RadarFilters) {
  return {
    search: firstValue(params.busca).replaceAll('\0', '').trim().slice(0, 120),
    area: firstValue(params.area).replaceAll('\0', '').trim().slice(0, 60),
  };
}

export function radarSelection(params: RadarFilters) {
  return { ...radarFilters(params), page: pageNumber(params.pagina) };
}

export function radarHref({ search, area }: ReturnType<typeof radarFilters>, page = 1) {
  const query = new URLSearchParams();
  if (search) query.set('busca', search);
  if (area) query.set('area', area);
  if (page > 1) query.set('pagina', String(page));
  return query.size ? '/oportunidades?' + query.toString() : '/oportunidades';
}

export function comparisonIds(value: SearchValue) {
  const selection = typeof value === 'string' ? [value] : value ?? [];
  if (selection.length < 2 || selection.length > 3) return null;

  const ids = selection.map((id) => id.toLowerCase());
  if (new Set(ids).size !== ids.length || !ids.every((id) => opportunityId.safeParse(id).success)) return null;
  return ids;
}

function pageNumber(value: SearchValue) {
  const page = firstValue(value);
  return /^[1-9]\d{0,8}$/.test(page) ? Number(page) : 1;
}

export function agendaSelection(params: AgendaParams) {
  const days = firstValue(params.dias);
  const period = agendaPeriods.find((option) => String(option) === days) ?? 30;
  return { period, page: pageNumber(params.pagina) };
}

export async function listRadarOpportunities(
  municipalityId: string,
  { search, area, page }: ReturnType<typeof radarSelection>,
) {
  // strpos treats wildcard characters as text; the UTF-8 collation lowercases accented letters.
  const rows = await queryForMunicipality<Opportunity & { is_example: boolean }>(
    municipalityId,
    `SELECT ${columns}, source_url, areas, eligible_ufs, min_population, max_population, funding_amount, created_at
     FROM opportunities
     WHERE ($1::text = '' OR strpos(
       lower((title || ' ' || provider) COLLATE pg_catalog.pg_c_utf8),
       lower($1 COLLATE pg_catalog.pg_c_utf8)
     ) > 0)
       AND ($2::text = '' OR EXISTS (
         SELECT 1 FROM unnest(areas) AS tags(tag)
         WHERE strpos(lower(tag COLLATE pg_catalog.pg_c_utf8), lower($2 COLLATE pg_catalog.pg_c_utf8)) > 0
       ))
     ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
    [search, area, radarPageSize + 1, (page - 1) * radarPageSize],
  );
  return { opportunities: rows.slice(0, radarPageSize), hasNext: rows.length > radarPageSize };
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
