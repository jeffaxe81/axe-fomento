import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { query, queryForMunicipality, type Municipality, type Opportunity } from '@/lib/db';
import { evaluateMatch } from '@/lib/match.mjs';
import { formatMoney } from '@/lib/format';
import { ProjectCreateButton } from '@/components/project-create-button';
export const dynamic = 'force-dynamic';
export default async function Opportunities({ searchParams }: { searchParams: Promise<{ busca?: string; area?: string }> }) {
  const user = await requireSession();
  const [city] = await queryForMunicipality<Municipality>('SELECT id, name, uf, ibge_code, population, priority_areas FROM municipalities WHERE id=$1', user.municipality_id, [user.municipality_id]);
  const rows = await query<Opportunity & { is_example: boolean }>(`SELECT id, title, provider, source_url, to_char(deadline, 'YYYY-MM-DD') AS deadline, areas, eligible_ufs, min_population, max_population, funding_amount, is_example, created_at FROM opportunities ORDER BY created_at DESC LIMIT 100`);
  const { busca = '', area = '' } = await searchParams;
  const safeSearch = busca.trim().slice(0, 120).toLowerCase();
  const safeArea = area.trim().slice(0, 60).toLowerCase();
  const results = rows.filter(o => (!safeSearch || `${o.title} ${o.provider}`.toLowerCase().includes(safeSearch)) && (!safeArea || o.areas.some(a => a.toLowerCase().includes(safeArea)))).map(o => ({ ...o, match: evaluateMatch(city, o) })).sort((a,b) => b.match.score-a.match.score);
  return <>
    <div className="section-eyebrow">INTELIGÊNCIA DE CAPTAÇÃO</div><div className="page-heading"><div><h1>Radar de oportunidades</h1><p>Consulte iniciativas de financiamento e compare a aderência ao perfil municipal.</p></div><Link className="btn btn-outline" href="/">← Voltar ao painel</Link></div>
    <form className="filters" method="get"><label>Buscar oportunidade<input name="busca" type="search" placeholder="Título ou instituição" defaultValue={busca}/></label><label>Área temática<input name="area" type="search" placeholder="Ex.: saúde" defaultValue={area}/></label><button type="submit" className="btn btn-primary">Filtrar</button><Link className="btn btn-light" href="/oportunidades">Limpar</Link></form>
    <div className="results-summary">{results.length} oportunidades encontradas · Pontuação preliminar conforme cadastro do município</div>
    <div className="opportunity-cards">{results.map(o => <article className="result-card" key={o.id}><div className="result-content"><div className="small-tags">{o.areas.map(a => <span className="chip" key={a}>{a}</span>)}{o.is_example && <span className="chip demo">FICTÍCIO / TESTE</span>}</div><h3>{o.title}</h3><p>{o.provider}</p><div className="result-meta"><span>Prazo: <b>{o.deadline ? new Date(`${o.deadline}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não informado'}</b></span><span>Valor: <b>{formatMoney(o.funding_amount)}</b></span><span>Abrangência: <b>{o.eligible_ufs.length ? o.eligible_ufs.join(', ') : 'A verificar'}</b></span></div><div className="result-actions"><ProjectCreateButton opportunityId={o.id} opportunityTitle={o.title}/>{o.source_url && <a href={o.source_url} target="_blank" rel="noreferrer" className="btn btn-light">Fonte oficial ↗</a>}</div></div><aside className="match-panel"><span>ADERÊNCIA PRELIMINAR</span><strong>{o.match.score}%</strong><b>{o.match.band}</b><p>{o.match.reasons[0] || 'Revisão necessária'}</p></aside></article>)}{results.length === 0 && <div className="empty-state">Nenhuma oportunidade corresponde aos filtros atuais.</div>}</div>
    <p className="note">A análise automática não substitui a leitura do edital, a verificação de habilitação jurídica, a documentação exigida ou a confirmação de prazo na fonte oficial.</p>
  </>;
}
