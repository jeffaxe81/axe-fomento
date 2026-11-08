import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality, type Opportunity } from '@/lib/db';
import { formatMoney, formatOpportunityDate } from '@/lib/format';
import { FavoriteButton } from '@/components/favorite-button';

export const dynamic = 'force-dynamic';
type FavoriteOpportunity = Opportunity & { is_example: boolean };

export default async function FavoriteOpportunities() {
  const user = await requireSession();
  const saved = await queryForMunicipality<FavoriteOpportunity>(user.municipality_id,
    "SELECT o.id,o.title,o.provider,o.source_url,to_char(o.deadline,'YYYY-MM-DD') AS deadline," +
    "o.areas,o.eligible_ufs,o.min_population,o.max_population,o.funding_amount,o.is_example,o.created_at " +
    "FROM opportunity_favorites f JOIN opportunities o ON o.id=f.opportunity_id " +
    "WHERE f.municipality_id=$1 AND f.user_id=$2 " +
    "ORDER BY f.created_at DESC,f.opportunity_id DESC LIMIT 100",
    [user.municipality_id, user.id], user.id);
  return <>
    <div className="section-eyebrow">INTELIGÊNCIA DE CAPTAÇÃO</div>
    <div className="page-heading">
      <div><h1>Minhas oportunidades favoritas</h1>
        <p>Lista persistente e privada desta conta institucional.</p></div>
      <Link className="btn btn-outline" href="/oportunidades">← Voltar ao radar</Link>
    </div>
    <div className="results-summary">{saved.length} oportunidades favoritas {saved.length === 100 ? '(100 mais recentes)' : ''}</div>
    <div className="opportunity-cards">
      {saved.map((o) => <article className="panel favorite-card" key={o.id}>
        <div className="small-tags">
          {o.areas.map((area) => <span className="chip" key={area}>{area}</span>)}
          {o.is_example && <span className="chip demo">FICTÍCIO / TESTE</span>}
        </div>
        <h2>{o.title}</h2>
        <p>{o.provider}</p>
        <p className="muted">Prazo: {formatOpportunityDate(o.deadline)} · Valor: {formatMoney(o.funding_amount)}</p>
        <div className="radar-actions">
          <FavoriteButton opportunityId={o.id} initialSaved />
          {o.source_url && <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="btn btn-light">Ver fonte ↗</a>}
        </div>
      </article>)}
      {!saved.length && <div className="empty-state">
        <h2>Você ainda não favoritou oportunidades.</h2>
        <Link className="btn btn-primary" href="/oportunidades">Explorar o radar</Link>
      </div>}
    </div>
    <p className="note">Oportunidades fictícias são sinalizadas. Confirme sempre os requisitos na fonte oficial.</p>
  </>;
}
