import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality, type Municipality, type Opportunity } from '@/lib/db';
import { evaluateMatch } from '@/lib/match.mjs';
import { formatMoney, formatOpportunityDate } from '@/lib/format';
import { classifyDeadline, radarReferenceDate } from '@/lib/opportunity-deadline.mjs';
import { radarFilters, type RadarFilters } from '@/lib/opportunity-radar';
import { ProjectCreateButton } from '@/components/project-create-button';
import { FavoriteButton } from '@/components/favorite-button';
import { SavedSearches } from '@/components/saved-searches';

export const dynamic = 'force-dynamic';

export default async function Opportunities({ searchParams }: { searchParams: Promise<RadarFilters> }) {
  const user = await requireSession();
  const [city] = await queryForMunicipality<Municipality>(user.municipality_id, 'SELECT id, name, uf, ibge_code, population, priority_areas FROM municipalities WHERE id=$1', [user.municipality_id]);
  const rows = await queryForMunicipality<Opportunity & { is_example: boolean }>(user.municipality_id, `SELECT id, title, provider, source_url, to_char(deadline, 'YYYY-MM-DD') AS deadline, areas, eligible_ufs, min_population, max_population, funding_amount, is_example, created_at FROM opportunities ORDER BY created_at DESC LIMIT 100`);
  const [favorites, savedSearches] = await Promise.all([
    queryForMunicipality<{ opportunity_id: string }>(user.municipality_id,
      'SELECT opportunity_id FROM opportunity_favorites WHERE municipality_id=$1 AND user_id=$2',
      [user.municipality_id, user.id], user.id),
    queryForMunicipality<{ id: string; name: string; search: string; area: string }>(user.municipality_id,
      'SELECT id,name,search_text AS search,area FROM saved_opportunity_searches ' +
      'WHERE municipality_id=$1 AND user_id=$2 ORDER BY lower(name),id LIMIT 100',
      [user.municipality_id, user.id], user.id),
  ]);
  const favoriteIds = new Set(favorites.map((favorite) => favorite.opportunity_id));
  const { search, area } = radarFilters(await searchParams);
  const safeSearch = search.toLowerCase();
  const safeArea = area.toLowerCase();
  const reference = radarReferenceDate();
  const results = rows
    .filter((o) => (!safeSearch || `${o.title} ${o.provider}`.toLowerCase().includes(safeSearch))
      && (!safeArea || o.areas.some((a) => a.toLowerCase().includes(safeArea))))
    .map((o) => ({ ...o, match: evaluateMatch(city, o, reference), deadlineState: classifyDeadline(o.deadline, reference) }))
    .sort((a, b) => b.match.score - a.match.score);
  const canCompare = results.length >= 2;

  return <>
    <div className="section-eyebrow">INTELIGÊNCIA DE CAPTAÇÃO</div>
    <div className="page-heading">
      <div>
        <h1>Radar de oportunidades</h1>
        <p>Consulte iniciativas de financiamento e compare a aderência ao perfil municipal.</p>
      </div>
      <div className="radar-actions">
        <Link className="btn btn-outline" href="/oportunidades/agenda">Agenda de prazos</Link>
        <Link className="btn btn-outline" href="/oportunidades/favoritos">Meus favoritos</Link>
        <Link className="btn btn-outline" href="/">← Voltar ao painel</Link>
      </div>
    </div>
    <form className="filters" method="get" action="/oportunidades">
      <label>
        Buscar oportunidade
        <input name="busca" type="search" placeholder="Título ou instituição" defaultValue={search} maxLength={120} />
      </label>
      <label>
        Área temática
        <input name="area" type="search" placeholder="Ex.: saúde" defaultValue={area} maxLength={60} />
      </label>
      <button type="submit" className="btn btn-primary">Filtrar</button>
      <a className="btn btn-light" href="/oportunidades">Limpar</a>
    </form>
    <SavedSearches initialItems={savedSearches} currentFilters={{ search, area }} />
    {canCompare && (
      <form className="radar-toolbar" id="radar-comparison" action="/oportunidades/comparar" method="get">
        {search && <input type="hidden" name="busca" value={search} />}
        {area && <input type="hidden" name="area" value={area} />}
        <button type="submit" className="btn btn-outline">Comparar seleção</button>
        <span id="radar-comparison-help">Marque 2 ou 3 oportunidades na lista.</span>
      </form>
    )}
    <div className="results-summary">{results.length} oportunidades encontradas · Pontuação preliminar conforme cadastro do município</div>
    <div className="opportunity-cards">
      {results.map((o) => (
        <article className="result-card" key={o.id}>
          <div className="result-content">
            <div className="small-tags">
              {o.areas.map((a) => <span className="chip" key={a}>{a}</span>)}
              {o.is_example && <span className="chip demo">FICTÍCIO / TESTE</span>}
            </div>
            <h3>{o.title}</h3>
            <p>{o.provider}</p>
            <div className="result-meta">
              <span>
                <b>{o.deadlineState.label}</b>
                {o.deadline && <time dateTime={o.deadline} className="radar-deadline">{formatOpportunityDate(o.deadline)}</time>}
              </span>
              <span>Valor <b>{formatMoney(o.funding_amount)}</b></span>
              <span>Abrangência <b>{o.eligible_ufs.length ? o.eligible_ufs.join(', ') : 'A verificar'}</b></span>
            </div>
            <div className="result-actions radar-actions">
              <ProjectCreateButton opportunityId={o.id} opportunityTitle={o.title} />
              <FavoriteButton opportunityId={o.id} initialSaved={favoriteIds.has(o.id)} />
              {o.source_url && <a href={o.source_url} target="_blank" rel="noreferrer" className="btn btn-light">Fonte oficial ↗</a>}
              {canCompare && (
                <label className="radar-choice">
                  <input type="checkbox" name="id" value={o.id} form="radar-comparison"
                    aria-label={'Selecionar ' + o.title + ' para comparar'} aria-describedby="radar-comparison-help" />
                  Selecionar para comparar
                </label>
              )}
            </div>
          </div>
          <aside className="match-panel">
            <span>ADERÊNCIA PRELIMINAR</span>
            <strong>{o.match.score}%</strong>
            <b>{o.match.band}</b>
            <p>{o.match.reasons[0] || 'Revisão necessária'}</p>
          </aside>
        </article>
      ))}
      {results.length === 0 && <div className="empty-state">Nenhuma oportunidade corresponde aos filtros atuais.</div>}
    </div>
    <p className="note">Prazos exibidos com referência à data de Brasília em {formatOpportunityDate(reference.toISOString().slice(0, 10))}.</p>
    <p className="note">A análise automática não substitui a leitura do edital, a verificação de habilitação jurídica, a documentação exigida ou a confirmação de prazo na fonte oficial.</p>
  </>;
}
