import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { RequirementCreateForm } from '@/components/requirement-create-form';
import { RequirementAssessmentForm } from '@/components/requirement-assessment-form';

export const dynamic = 'force-dynamic';
type ProjectContext = {
  id:string; title:string; opportunity_id:string|null;
  opportunity_title:string|null; is_example:boolean|null;
};
type RequirementRow = {
  id:string; requirement:string; mandatory:boolean; source_url:string;
  source_version:string;source_section:string;evidence_excerpt:string;
  status:'atendido'|'nao_atendido'|'pendente'|null;evidence_note:string|null;
};
const statusLabels = {
  atendido:'Atendido (declarado)', nao_atendido:'Não atendido (declarado)', pendente:'Pendente de comprovação',
};
export default async function ProjectRequirements({params}:{params:Promise<{id:string}>}) {
  const user=await requireSession();
  const {id}=await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [project]=await queryForMunicipality<ProjectContext>(user.municipality_id,
    'SELECT p.id,p.title,p.opportunity_id,o.title AS opportunity_title,o.is_example '+
      'FROM projects p LEFT JOIN opportunities o ON o.id=p.opportunity_id '+
      'WHERE p.municipality_id=$1 AND p.id=$2',
    [user.municipality_id,id],user.id);
  if(!project) notFound();
  const requirements=project.opportunity_id ? await queryForMunicipality<RequirementRow>(
    user.municipality_id,
    'SELECT r.id,r.requirement,r.mandatory,r.source_url,r.source_version,r.source_section,'+
      'r.evidence_excerpt,a.status,a.evidence_note FROM opportunity_requirements r '+
      'LEFT JOIN project_requirement_assessments a ON a.requirement_id=r.id '+
      'AND a.project_id=$3 AND a.municipality_id=r.municipality_id '+
      'WHERE r.municipality_id=$1 AND r.opportunity_id=$2 '+
      'ORDER BY r.created_at,r.id LIMIT 200',
    [user.municipality_id,project.opportunity_id,id],user.id,
  ) : [];
  const counts={atendido:0,nao_atendido:0,pendente:0};
  for(const rule of requirements) counts[rule.status ?? 'pendente']++;

  return <>
    <div className="section-eyebrow">DIAGNÓSTICO MUNICIPAL</div>
    <div className="page-heading">
      <div>
        <h1>Requisitos do projeto</h1>
        <p>{project.title} · {project.opportunity_title ?? 'Oportunidade não vinculada'}</p>
      </div>
      <Link href={'/projetos/'+project.id} className="btn btn-outline">← Voltar à ficha</Link>
    </div>
    {project.is_example && <p className="demo-notice"><strong>FICTÍCIO / TESTE:</strong> a oportunidade vinculada é ilustrativa.</p>}
    <section className="panel requirement-overview">
      <h2>Diagnóstico preliminar da equipe</h2>
      <div className="requirement-stats">
        <div><strong>{counts.atendido}</strong><span>Atendidos (declarados)</span></div>
        <div><strong>{counts.nao_atendido}</strong><span>Não atendidos (declarados)</span></div>
        <div><strong>{counts.pendente}</strong><span>Pendentes de comprovação</span></div>
      </div>
      <p className="help">Ausência de avaliação equivale a pendente. Não há pontuação automática nem
        conclusão jurídica; todas as avaliações precisam de conferência humana.</p>
    </section>
    {!project.opportunity_id ? <section className="panel">
      <h2>Nenhuma oportunidade vinculada</h2>
      <p>Vincule o projeto a uma oportunidade antes de criar a matriz de requisitos.</p>
    </section> : <>
      {user.role==='admin' && <RequirementCreateForm opportunityId={project.opportunity_id}/>}
      <section className="panel requirement-list">
        <h2>Matriz de requisitos documentados</h2>
        {requirements.length ? requirements.map(rule=><article key={rule.id} className="requirement-item">
          <div className="small-tags">
            <span className="chip">{rule.mandatory?'Obrigatório informado':'Não obrigatório informado'}</span>
            <span className="chip">{statusLabels[rule.status ?? 'pendente']}</span>
          </div>
          <h3>{rule.requirement}</h3>
          <dl>
            <div><dt>Versão / retificação</dt><dd>{rule.source_version}</dd></div>
            <div><dt>Item da fonte</dt><dd>{rule.source_section}</dd></div>
            <div><dt>Trecho indicado</dt><dd>{rule.evidence_excerpt}</dd></div>
          </dl>
          <a href={rule.source_url} target="_blank" rel="noopener noreferrer" className="source-link">
            Abrir fonte indicada (não verificada) ↗</a>
          <RequirementAssessmentForm key={rule.id+'-'+(rule.status??'pendente')+'-'+(rule.evidence_note??'')}
            projectId={project.id} requirementId={rule.id}
            initialStatus={rule.status??'pendente'} initialEvidence={rule.evidence_note??''}/>
        </article>) : <p className="muted">Ainda não existem requisitos registrados para esta oportunidade no município.</p>}
      </section>
    </>}
  </>;
}
