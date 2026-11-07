import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { FinancingSimulation } from '@/components/financing-simulation';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { READ_BUDGET_TOTAL_SQL } from '@/lib/project-budget-sql.mjs';
import { findMunicipalProject } from '@/lib/project-portfolio';

export const dynamic = 'force-dynamic';

const projectIdSchema = z.string().uuid();

export default async function ProjectFinancing({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  if (!projectIdSchema.safeParse(id).success) notFound();

  const project = await findMunicipalProject(user.municipality_id, id);
  if (!project) notFound();

  const [total] = await queryForMunicipality<{ total_cents: string }>(
    user.municipality_id,
    READ_BUDGET_TOTAL_SQL,
    [user.municipality_id, project.id],
    user.id,
  );
  const budgetTotalCents = total?.total_cents ?? '0';
  const projectHref = '/projetos/' + project.id;

  return <>
    <div className="section-eyebrow">PREPARAÇÃO FINANCEIRA · AF-027</div>
    <div className="page-heading">
      <div>
        <h1>Cenários de parcelas</h1>
        <p>{project.title}</p>
      </div>
      <div className="radar-actions">
        <Link href={projectHref + '/orcamento'} className="btn btn-outline">Voltar ao orçamento</Link>
        <Link href={projectHref} className="btn btn-outline">Voltar ao projeto</Link>
      </div>
    </div>
    {project.opportunity_is_example && <p className="demo-notice">
      <span className="chip demo">FICTÍCIO / TESTE</span> Projeto vinculado a uma oportunidade fictícia.
    </p>}
    <FinancingSimulation key={project.id + '/' + budgetTotalCents} budgetTotalCents={budgetTotalCents} />
  </>;
}
