import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {MISSING_LABELS,SECTION_LABELS,type ProposalSections} from '@/lib/proposal-draft.mjs';
import {READ_PROPOSAL_VERSIONS_SQL} from '@/lib/proposal-sql.mjs';
import {ProposalCreateForm,ProposalRevisionForm} from '@/components/proposal-forms';
import {ProposalReviewForm} from '@/components/proposal-review-form';
import {READ_PROPOSAL_REVIEW_SUMMARIES_SQL} from '@/lib/proposal-review-sql.mjs';
import {PROPOSAL_REVIEW_LABELS,proposalApprovalBlockers} from '@/lib/proposal-review.mjs';

export const dynamic='force-dynamic';
type Project={id:string;title:string;status:string;owner_user_id:string|null;is_example:boolean|null};
type Draft={id:string;created_at:string;author_name:string};
type Revision={id:string;draft_id:string;version:number;sections:ProposalSections;
 source_snapshot:{method?:string;budget?:{items:number;totalCents:string};
 requirements?:unknown[];evidence?:unknown[]};missing_fields:string[];
 revision_note:string;origin:string;created_at:string;author_id:string;author_name:string};
type ReviewSummary={version_id:string;revision:number;decision:'aprovada'|'devolvida';
 review_note:string;reviewer_name:string;reviewed_at:string;
 acknowledged_missing_sources:boolean};
export default async function ProposalPage({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(actor.municipality_id,
  `SELECT p.id,p.title,p.status,p.owner_user_id,o.is_example FROM projects p
    LEFT JOIN opportunities o ON o.id=p.opportunity_id
    WHERE p.id=$1::uuid AND p.municipality_id=$2::uuid`,
  [id,actor.municipality_id],actor.id);
 if(!project)notFound();
 const [draft]=await queryForMunicipality<Draft>(actor.municipality_id,
  `SELECT d.id,d.created_at,u.full_name AS author_name
    FROM project_proposal_drafts d JOIN users u ON u.id=d.created_by
     AND u.municipality_id=d.municipality_id
    WHERE d.project_id=$1::uuid AND d.municipality_id=$2::uuid`,
  [id,actor.municipality_id],actor.id);
 const versions=draft?await queryForMunicipality<Revision>(
  actor.municipality_id,READ_PROPOSAL_VERSIONS_SQL,
  [actor.municipality_id,id,draft.id],actor.id):[];
 const reviews=draft?await queryForMunicipality<ReviewSummary>(actor.municipality_id,
  READ_PROPOSAL_REVIEW_SUMMARIES_SQL,[actor.municipality_id,id,draft.id],actor.id):[];
 const reviewByVersion=new Map(reviews.map(item=>[item.version_id,item]));
 const latest=versions[0];
 const latestReview=latest?reviewByVersion.get(latest.id):undefined;
 const canReview=process.env.ENABLE_PROPOSAL_CONTENT_REVIEWS==='yes'&&
  !project.is_example&&actor.role==='admin'&&!!latest&&
  actor.id!==latest.author_id;
 const canEdit=process.env.ENABLE_PROPOSAL_DRAFTS==='yes'&&!project.is_example&&
  (actor.role==='admin'||actor.id===project.owner_user_id);
 const when=(date:string)=>new Date(date).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 return <>
  <div className="section-eyebrow">PROPOSTA ASSISTIDA · AF-032/033</div>
  <div className="page-heading"><div><h1>Rascunho de proposta</h1><p>{project.title}</p></div>
   <div className="radar-actions">
    <Link className="btn btn-outline" href={'/projetos/'+id+'/orcamento'}>Orçamento</Link>
    <Link className="btn btn-outline" href={'/projetos/'+id+'/requisitos'}>Requisitos</Link>
    <Link className="btn btn-outline" href={'/projetos/'+id+'/extracao-edital'}>Edital</Link>
    <Link className="btn btn-outline" href={'/projetos/'+id}>Voltar à ficha</Link>
   </div></div>
  <section className="panel">
   <h2>Rascunho interno, não aprovado</h2>
   <p>O sistema prepara um modelo editável a partir do projeto, planejamento
    físico-financeiro, requisitos cadastrados e sugestões de edital
    com aprovação <strong>apenas interna</strong>. Não utiliza IA generativa,
    não envia dados externos, não certifica elegibilidade e não protocola
    automaticamente a proposta.</p>
   {project.is_example&&<p className="demo-notice">Oportunidade fictícia:
    geração e edição indisponíveis.</p>}
  </section>
  {!draft&&<section className="panel">
   <h2>Preparar versão 1</h2>
   {canEdit?<ProposalCreateForm projectId={id}/>:
    <p className="muted">É necessário homologação e titularidade do
     projeto ou permissão de administrador para iniciar o rascunho.</p>}
  </section>}
  {latest&&<section className="panel">
   <h2>Fontes e pendências preservadas</h2>
   <p>Versão {latest.version} · {latest.origin==='template_from_local_data'?
    'Modelo inicial':'Revisão manual'} · Criado por {latest.author_name} em
    {' '}{when(latest.created_at)}</p>
   <p><strong>Itens orçamentários na origem:</strong>
    {' '}{latest.source_snapshot?.budget?.items??'não informado'}</p>
   <p><strong>Requisitos registrados na origem:</strong>
    {' '}{latest.source_snapshot?.requirements?.length??0}</p>
   <p><strong>Sugestões internamente revisadas na origem:</strong>
    {' '}{latest.source_snapshot?.evidence?.length??0}</p>
   <h3>Pendências da base de informações</h3>
   <ul>{latest.missing_fields.map(code=><li key={code}>
    {MISSING_LABELS[code]??code}</li>)}</ul>
   {!latest.missing_fields.length&&<p>Não há lacunas identificadas pelo modelo,
    mas a conferência documental e jurídica continua obrigatória.</p>}
   <p className="note">O levantamento de pendências é um instantâneo da
    geração original. Revisões manuais não alteram retroativamente
    as evidências armazenadas nem comprovam a solução dessas lacunas.</p>
  </section>}
  {latest&&<section className="panel">
   <h2>Editar seções — versão atual {latest.version}</h2>
   {canEdit&&latest.version<500?<ProposalRevisionForm
    key={draft!.id+'-'+latest.version} projectId={id} draftId={draft!.id}
    version={latest.version} sections={latest.sections}/>:
    <div>{SECTION_LABELS.map(([key,label])=><article className="review-event" key={key}>
     <h3>{label}</h3><p style={{whiteSpace:'pre-wrap'}}>
      {latest.sections[key as keyof ProposalSections]}</p></article>)}</div>}
  </section>}
  {latest&&<section className="panel" id="revisao-editorial">
   <h2>Revisão editorial humana da versão {latest.version}</h2>
   <p data-current-review-status={latestReview?.decision??'pendente'}>
    <strong>Situação atual desta versão:</strong>
    {' '}{latestReview?PROPOSAL_REVIEW_LABELS[latestReview.decision]:
     'Pendente de revisão editorial'}</p>
   {latestReview&&<p className="help">Último revisor:
    {' '}{latestReview.reviewer_name} · {latestReview.review_note}</p>}
   <p className="note">Esta decisão se aplica exclusivamente à versão
    indicada. Aprovação editorial não significa edital homologado,
    habilitação jurídica nem submissão da proposta. Uma nova versão
    inicia pendente de revisão própria.</p>
   {canReview?<ProposalReviewForm
    key={latest.id+'-'+(latestReview?.revision??0)}
    projectId={id} draftId={draft!.id} versionId={latest.id}
    expectedReviewRevision={latestReview?.revision??0}
    hasPlaceholders={proposalApprovalBlockers(latest).length>0}/>:
    <p className="muted">Somente um administrador municipal ativo
     que não seja o autor desta versão pode decidir. O recurso depende
     de homologação operacional.</p>}
   <p><Link href={'/projetos/'+id+'/proposta/revisoes/'+latest.id}>
    Histórico completo de decisões da versão atual</Link></p>
  </section>}
  {draft&&<section className="panel">
   <h2>Histórico de versões ({versions.length} exibidas)</h2>
   {versions.map(v=><article key={v.id} className="review-event" data-version={v.version}>
    <span className="chip">Versão {v.version} · {v.origin==='manual_revision'?
     'Revisão manual':'Gerada com template'}</span>
    <p><strong>Nota:</strong> {v.revision_note}</p>
    <p><strong>Decisão editorial:</strong>
     {' '}{reviewByVersion.has(v.id)?
      PROPOSAL_REVIEW_LABELS[reviewByVersion.get(v.id)!.decision]:
      'Pendente de revisão editorial'}</p>
    <p><Link href={'/projetos/'+id+'/proposta/revisoes/'+v.id}>
     Ver decisões desta versão</Link></p>
    <p className="help">Autor: {v.author_name} · {when(v.created_at)}</p>
    {v.version!==latest?.version&&<details><summary>Consultar redação histórica</summary>
     {SECTION_LABELS.map(([key,label])=><div key={key}>
      <h4>{label}</h4><p style={{whiteSpace:'pre-wrap'}}>
       {v.sections[key as keyof ProposalSections]}</p>
     </div>)}</details>}
   </article>)}
   {versions.length===50&&<p className="note">Exibição limitada às 50
    versões mais recentes. As anteriores continuam no banco.</p>}
  </section>}
 </>;
}
