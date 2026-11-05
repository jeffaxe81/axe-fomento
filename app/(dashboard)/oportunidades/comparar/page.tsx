import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { formatFundingAmount, formatOpportunityDate } from '@/lib/format';
import { comparisonIds, getComparisonOpportunities, radarFilters, radarHref, type ComparisonParams } from '@/lib/opportunity-radar';

export const dynamic = 'force-dynamic';

export default async function CompareOpportunities({ searchParams }: { searchParams: Promise<ComparisonParams> }) {
  const user = await requireSession();
  const params = await searchParams;
  const back = radarHref(radarFilters(params));
  const ids = comparisonIds(params.id);
  const opportunities = ids ? await getComparisonOpportunities(user.municipality_id, ids) : [];
  const fields = [
    { label: 'Órgão', values: opportunities.map((o) => o.provider.trim() || 'Não informado') },
    { label: 'Valor', values: opportunities.map((o) => formatFundingAmount(o.funding_amount)) },
    { label: 'Prazo', values: opportunities.map((o) => formatOpportunityDate(o.deadline)) },
    { label: 'Área temática', values: opportunities.map((o) => o.areas.join(', ') || 'Não informada') },
    { label: 'Abrangência', values: opportunities.map((o) => o.eligible_ufs.join(', ') || 'Não informada') },
  ];

  return <>
    <div className="section-eyebrow">INTELIGÊNCIA DE CAPTAÇÃO</div>
    <div className="page-heading">
      <div>
        <h1>Comparar oportunidades</h1>
        <p>Confira lado a lado os dados cadastrados no radar.</p>
      </div>
      <Link href={back} className="btn btn-outline">← Voltar ao radar</Link>
    </div>
    <section className="panel">
      {!ids ? (
        <p>Selecione 2 ou 3 oportunidades diferentes.</p>
      ) : opportunities.length !== ids.length ? (
        <p>Uma ou mais oportunidades estão indisponíveis.</p>
      ) : (
        <div className="table-scroll" role="region" aria-label="Comparação de oportunidades" tabIndex={0}>
          <table className="radar-comparison">
            <thead>
              <tr>
                <th scope="col">Informação</th>
                {opportunities.map((opportunity) => (
                  <th scope="col" key={opportunity.id}>
                    {opportunity.title}
                    {opportunity.is_example && <span className="chip demo radar-example">FICTÍCIO / TESTE</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map(({ label, values }) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {opportunities.map((opportunity, index) => <td key={opportunity.id}>{values[index]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  </>;
}
