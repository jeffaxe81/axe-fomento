import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { formatOpportunityDate } from '@/lib/format';
import { classifyDeadline, radarReferenceDate } from '@/lib/opportunity-deadline.mjs';
import { agendaPeriods, agendaSelection, listAgendaOpportunities, type AgendaParams } from '@/lib/opportunity-radar';

export const dynamic = 'force-dynamic';

function agendaHref(period: number, page = 1) {
  return '/oportunidades/agenda?dias=' + period + (page > 1 ? '&pagina=' + page : '');
}

export default async function OpportunityAgenda({ searchParams }: { searchParams: Promise<AgendaParams> }) {
  const user = await requireSession();
  const selection = agendaSelection(await searchParams);
  const { period, page } = selection;
  const reference = radarReferenceDate();
  const day = reference.toISOString().slice(0, 10);
  const { opportunities, hasNext } = await listAgendaOpportunities(user.municipality_id, day, selection);

  return <>
    <div className="section-eyebrow">INTELIGÊNCIA DE CAPTAÇÃO</div>
    <div className="page-heading">
      <div>
        <h1>Agenda de prazos</h1>
        <p>Hoje e os próximos {period} dias. A agenda usa a data de <time dateTime={day}>{formatOpportunityDate(day)}</time> em Brasília.</p>
      </div>
      <Link href="/oportunidades" className="btn btn-outline">← Voltar ao radar</Link>
    </div>
    <nav className="radar-toolbar" aria-label="Período da agenda">
      {agendaPeriods.map((days) => (
        <Link key={days} href={agendaHref(days)} className={'btn ' + (days === period ? 'btn-primary' : 'btn-outline')}
          aria-current={days === period ? 'page' : undefined}>
          {days} dias
        </Link>
      ))}
    </nav>
    <section className="panel">
      {opportunities.length > 0 ? (
        <div className="table-scroll" role="region" aria-label="Oportunidades por prazo" tabIndex={0}>
          <table className="radar-agenda">
            <thead>
              <tr>
                <th scope="col">Prazo</th>
                <th scope="col">Oportunidade</th>
                <th scope="col">Órgão</th>
                <th scope="col">Situação do prazo</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opportunity) => (
                <tr key={opportunity.id}>
                  <td><time dateTime={opportunity.deadline ?? undefined}>{formatOpportunityDate(opportunity.deadline)}</time></td>
                  <td>
                    <b>{opportunity.title}</b>
                    {opportunity.is_example && <span className="chip demo radar-example">FICTÍCIO / TESTE</span>}
                  </td>
                  <td>{opportunity.provider.trim() || 'Não informado'}</td>
                  <td>{classifyDeadline(opportunity.deadline, reference).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <h2>{page > 1 ? 'Nenhuma oportunidade nesta página' : 'Nenhum prazo cadastrado neste período'}</h2>
          {page > 1 && <Link href={agendaHref(period)} className="btn btn-outline">Voltar à primeira página</Link>}
        </div>
      )}
      {(page > 1 || hasNext) && (
        <nav className="radar-pagination" aria-label="Páginas da agenda">
          {page > 1 && <Link href={agendaHref(period, page - 1)} className="btn btn-outline">← Anterior</Link>}
          <span aria-current="page">Página {page}</span>
          {hasNext && <Link href={agendaHref(period, page + 1)} className="btn btn-outline">Próxima →</Link>}
        </nav>
      )}
    </section>
    <p className="note">Confira a data e o horário de encerramento na fonte do edital.</p>
  </>;
}
