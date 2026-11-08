import 'server-only';
import { queryForMunicipality, type Project } from '@/lib/db';
import { PROJECT_STATUSES } from '@/lib/project-status.mjs';

const statusLabels: Readonly<Record<string, string>> = {
  rascunho: 'Rascunho',
  preparacao: 'Em preparação',
  submetido: 'Submetido',
  aprovado: 'Aprovado',
  recusado: 'Não aprovado',
};

export function projectStatusLabel(status: string): string {
  return Object.hasOwn(statusLabels, status) ? statusLabels[status] : status;
}

type ProjectWithOpportunity = Project & { opportunity_is_example: boolean | null };
type ProjectDetails = ProjectWithOpportunity & { updated_at: string };

const projectColumns = 'p.id, p.title, p.status, p.created_at, o.title AS opportunity_title, ' +
  'o.is_example AS opportunity_is_example, u.full_name AS owner_name';
const projectFrom = 'FROM projects p ' +
  'LEFT JOIN opportunities o ON o.id = p.opportunity_id ' +
  'LEFT JOIN users u ON u.id = p.owner_user_id ' +
  'WHERE p.municipality_id = $1';
const pageSize = 25;

type SearchValue = string | string[] | undefined;
export type PortfolioParams = { busca?: SearchValue; situacao?: SearchValue; pagina?: SearchValue };

function firstValue(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export function portfolioFilters(params: PortfolioParams) {
  const search = firstValue(params.busca).replaceAll('\u0000', '').trim().slice(0, 180);
  const rawStatus = firstValue(params.situacao);
  const status = PROJECT_STATUSES.includes(rawStatus) ? rawStatus : '';
  const rawPage = firstValue(params.pagina);
  const page = /^[1-9]\d{0,8}$/.test(rawPage) ? Number(rawPage) : 1;
  return { search, status, page };
}

export async function listMunicipalProjects(
  municipalityId: string,
  { search, status, page }: ReturnType<typeof portfolioFilters>,
) {
  const rows = await queryForMunicipality<ProjectWithOpportunity>(
    municipalityId,
    'SELECT ' + projectColumns + ' ' + projectFrom +
      " AND ($2::text = '' OR strpos(lower(p.title), lower($2::text)) > 0)" +
      " AND ($3::text = '' OR p.status = $3::text)" +
      ' ORDER BY p.created_at DESC, p.id DESC LIMIT $4 OFFSET $5',
    [municipalityId, search, status, pageSize + 1, (page - 1) * pageSize],
  );
  return { projects: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
}

export async function findMunicipalProject(municipalityId: string, id: string) {
  const [project] = await queryForMunicipality<ProjectDetails>(
    municipalityId,
    'SELECT ' + projectColumns + ', p.updated_at ' + projectFrom + ' AND p.id = $2',
    [municipalityId, id],
  );
  return project ?? null;
}
