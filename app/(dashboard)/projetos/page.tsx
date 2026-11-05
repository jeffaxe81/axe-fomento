import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { listMunicipalProjects, portfolioFilters, projectStatusLabel, type PortfolioParams } from '@/lib/project-portfolio';
import { PROJECT_STATUSES } from '@/lib/project-status.mjs';

export const dynamic = 'force-dynamic';

export default async function Projects({ searchParams }: { searchParams: Promise<PortfolioParams> }) {
  const user = await requireSession();
  const filters = portfolioFilters(await searchParams);
  const { search, status, page } = filters;
  const { projects, hasNext } = await listMunicipalProjects(user.municipality_id, filters);
  const isFiltered = Boolean(search || status);

  function pageHref(target: number) {
    const query = new URLSearchParams();
    if (search) query.set('busca', search);
    if (status) query.set('situacao', status);
    if (target > 1) query.set('pagina', String(target));
    return query.size ? '/projetos?' + query.toString() : '/projetos';
  }

  return <>
    <div className="section-eyebrow">GESTÃO DE CAPTAÇÃO</div>
    <div className="page-heading">
      <div>
        <h1>Meus projetos</h1>
        <p>Centralize propostas e acompanhe o andamento das candidaturas.</p>
      </div>
      <Link href="/oportunidades" className="btn btn-primary">+ Novo projeto</Link>
    </div>

    <form action="/projetos" method="get" className="filters project-filters">
      <label>
        Título do projeto
        <input name="busca" type="search" maxLength={180} defaultValue={search} placeholder="Buscar por título" />
      </label>
      <label>
        Situação
        <select name="situacao" defaultValue={status}>
          <option value="">Todas</option>
          {PROJECT_STATUSES.map((item) => (
            <option key={item} value={item}>{projectStatusLabel(item)}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn btn-primary">Filtrar</button>
      <Link href="/projetos" className="btn btn-light">Limpar</Link>
    </form>

    <section className="panel">
      <div className="panel-heading">
        <h2 className="project-panel-title">Portfólio de projetos</h2>
        <span>{projects.length === 1 ? '1 projeto nesta página' : projects.length + ' projetos nesta página'}</span>
      </div>
      {projects.length > 0 ? (
        <div className="table-scroll" role="region" aria-label="Projetos municipais" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Projeto</th>
                <th scope="col">Oportunidade</th>
                <th scope="col">Responsável</th>
                <th scope="col">Situação</th>
                <th scope="col">Registro</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <Link className="project-title-link" href={'/projetos/' + project.id} prefetch={false}>
                      {project.title}
                    </Link>
                  </td>
                  <td>
                    {project.opportunity_title ?? 'Sem oportunidade vinculada'}
                    {project.opportunity_is_example && <span className="chip demo project-example">FICTÍCIO / TESTE</span>}
                  </td>
                  <td>{project.owner_name ?? 'Não atribuído'}</td>
                  <td><span className="status-pill">{projectStatusLabel(project.status)}</span></td>
                  <td>{new Date(project.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          {page > 1 ? (
            <>
              <h3>Nenhum projeto nesta página</h3>
              <Link href={pageHref(1)} className="btn btn-outline">Voltar à primeira página</Link>
            </>
          ) : isFiltered ? (
            <h3>Nenhum projeto corresponde aos filtros</h3>
          ) : (
            <>
              <h3>Você ainda não possui projetos cadastrados</h3>
              <p>Encontre uma oportunidade no radar para iniciar uma proposta.</p>
              <Link href="/oportunidades" className="btn btn-primary">Ir para o radar →</Link>
            </>
          )}
        </div>
      )}
      {(page > 1 || hasNext) && (
        <nav className="project-pagination" aria-label="Páginas de projetos">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn btn-outline">← Anterior</Link>}
          <span aria-current="page">Página {page}</span>
          {hasNext && <Link href={pageHref(page + 1)} className="btn btn-outline">Próxima →</Link>}
        </nav>
      )}
    </section>
  </>;
}
