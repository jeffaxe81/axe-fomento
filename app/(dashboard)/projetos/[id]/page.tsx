import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { findMunicipalProject, projectStatusLabel } from '@/lib/project-portfolio';

export const dynamic = 'force-dynamic';

const projectIdSchema = z.string().uuid();

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  if (!projectIdSchema.safeParse(id).success) notFound();
  const project = await findMunicipalProject(user.municipality_id, id);
  if (!project) notFound();

  return <>
    <div className="section-eyebrow">GESTÃO DE CAPTAÇÃO</div>
    <div className="page-heading project-detail-heading">
      <div>
        <h1>{project.title}</h1>
        <p>Ficha do projeto municipal</p>
      </div>
      <div className="radar-actions">
        <Link href={'/projetos/'+project.id+'/requisitos'} className="btn btn-primary">Matriz de requisitos</Link>
        <Link href={'/projetos/'+project.id+'/documentos'} className="btn btn-outline">Checklist documental</Link>
        <Link href={'/projetos/'+project.id+'/tarefas'} className="btn btn-outline">Tarefas por secretaria</Link>
        <Link href={'/projetos/'+project.id+'/revisao'} className="btn btn-outline">Revisão interna</Link>
        <Link href="/projetos" className="btn btn-outline">← Voltar aos projetos</Link>
      </div>
    </div>
    <section className="panel wide">
      <h2 className="project-panel-title">Dados do projeto</h2>
      <dl className="project-details">
        <div className="profile-row">
          <dt>Situação</dt>
          <dd><span className="status-pill">{projectStatusLabel(project.status)}</span></dd>
        </div>
        <div className="profile-row">
          <dt>Responsável</dt>
          <dd>{project.owner_name ?? 'Não atribuído'}</dd>
        </div>
        <div className="profile-row">
          <dt>Oportunidade vinculada</dt>
          <dd>
            {project.opportunity_title ?? 'Sem oportunidade vinculada'}
            {project.opportunity_is_example && <span className="chip demo project-example">FICTÍCIO / TESTE</span>}
          </dd>
        </div>
        <div className="profile-row">
          <dt>Data de registro</dt>
          <dd>{new Date(project.created_at).toLocaleDateString('pt-BR')}</dd>
        </div>
        <div className="profile-row">
          <dt>Última atualização</dt>
          <dd>{new Date(project.updated_at).toLocaleDateString('pt-BR')}</dd>
        </div>
      </dl>
    </section>
  </>;
}
