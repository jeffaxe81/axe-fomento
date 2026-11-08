import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {
 ReadinessEvidenceLink,ReadinessAssessmentCreate,ReadinessReviewForm,
 ReadinessActionAssign,ReadinessSimulator,
 type Rubric,type UserChoice,type EvidenceChoice,type ScoreRow,type Blocker
} from '@/components/readiness-detail-forms';
export const dynamic='force-dynamic';
type Case={id:string;kind:'idea'|'documented';project_id:string|null;title:string;
 problem:string;target_audience:string;objective:string;created_by:string;
 created_at:string;author_name:string;project_title:string|null};
type Evidence=EvidenceChoice&{note:string;sha256:string;added_at:string};
type Action={id:string;priority:string;reason:string;recommendation:string;impact:number};
type Assessment={id:string;revision:number;previous_id:string|null;
 rubric_id:string;rubric_version:number;rubric_snapshot:Rubric['criteria'];
 scores_snapshot:ScoreRow[];blockers_snapshot:Blocker[];action_plan_snapshot:Action[];
 evidence_snapshot:object[];score:string;maximum_possible_score:string;
 evaluated_weight:number;snapshot_sha256:string;revision_note:string;
 created_by:string;created_at:string;author_name:string};
type Review={id:string;assessment_id:string;revision:number;decision:string;
 note:string;reviewer_name:string;reviewed_at:string};
type Assignment={action_code:string;revision:number;responsible_name:string};
type Person=UserChoice;
export default async function ReadinessDetails({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [item]=await queryForMunicipality<Case>(actor.municipality_id,`
  SELECT c.*,u.full_name AS author_name,p.title AS project_title
  FROM readiness_cases c JOIN users u ON u.id=c.created_by AND u.municipality_id=c.municipality_id
  LEFT JOIN projects p ON p.id=c.project_id AND p.municipality_id=c.municipality_id
  WHERE c.id=$1::uuid AND c.municipality_id=$2::uuid`,
  [id,actor.municipality_id],actor.id);
 if(!item)notFound();
 const [rubrics,assessments,evidence,versions,people,reviews]=await Promise.all([
  queryForMunicipality<Rubric>(actor.municipality_id,`
   SELECT id,rubric_key,version,criteria FROM readiness_rubric_versions
   WHERE municipality_id=$1::uuid ORDER BY created_at DESC,id DESC LIMIT 100`,
   [actor.municipality_id],actor.id),
  queryForMunicipality<Assessment>(actor.municipality_id,`
   SELECT a.*,u.full_name AS author_name FROM readiness_assessments a
   JOIN users u ON u.id=a.created_by AND u.municipality_id=a.municipality_id
   WHERE a.municipality_id=$1::uuid AND a.case_id=$2::uuid
   ORDER BY a.revision DESC LIMIT 100`,[actor.municipality_id,id],actor.id),
  queryForMunicipality<Evidence>(actor.municipality_id,`
   SELECT e.version_id AS id,v.version,v.file_name,v.sha256,d.title AS item_title,
    e.note,e.added_at FROM readiness_case_evidence e
   JOIN project_document_versions v ON v.id=e.version_id AND v.municipality_id=e.municipality_id
   JOIN project_document_items d ON d.id=v.item_id AND d.municipality_id=v.municipality_id
   WHERE e.municipality_id=$1::uuid AND e.case_id=$2::uuid
   ORDER BY e.added_at DESC,e.id DESC LIMIT 100`,[actor.municipality_id,id],actor.id),
  item.project_id?queryForMunicipality<EvidenceChoice>(actor.municipality_id,`
   SELECT v.id,v.version,v.file_name,d.title AS item_title
   FROM project_document_versions v JOIN project_document_items d
    ON d.id=v.item_id AND d.municipality_id=v.municipality_id
   WHERE v.municipality_id=$1::uuid AND v.project_id=$2::uuid
   ORDER BY v.uploaded_at DESC,v.id DESC LIMIT 200`,
   [actor.municipality_id,item.project_id],actor.id):Promise.resolve([] as EvidenceChoice[]),
  queryForMunicipality<Person>(actor.municipality_id,`
   SELECT id,full_name FROM users WHERE municipality_id=$1::uuid AND active
   ORDER BY lower(full_name),id LIMIT 200`,[actor.municipality_id],actor.id),
  queryForMunicipality<Review>(actor.municipality_id,`
   SELECT r.id,r.assessment_id,r.revision,r.decision,r.note,
    u.full_name AS reviewer_name,r.reviewed_at
   FROM readiness_review_events r JOIN users u
    ON u.id=r.reviewer_id AND u.municipality_id=r.municipality_id
   WHERE r.municipality_id=$1::uuid AND r.case_id=$2::uuid
   ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 100`,
   [actor.municipality_id,id],actor.id)
 ]);
 const latest=assessments[0],enabled=process.env.ENABLE_READINESS_EVALUATOR==='yes';
 const canWrite=enabled&&(actor.role==='admin'||item.created_by===actor.id);
 const canReview=enabled&&actor.role==='admin'&&latest?.created_by!==actor.id;
 const assignments=latest?await queryForMunicipality<Assignment>(actor.municipality_id,`
  SELECT DISTINCT ON (s.action_code) s.action_code,s.revision,
   u.full_name AS responsible_name FROM readiness_action_assignments s
  JOIN users u ON u.id=s.responsible_user_id AND u.municipality_id=s.municipality_id
  WHERE s.municipality_id=$1::uuid AND s.assessment_id=$2::uuid
  ORDER BY s.action_code,s.revision DESC`,[actor.municipality_id,latest.id],actor.id):[];
 const stamp=(s:string)=>new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 const activeReview=latest?reviews.filter(x=>x.assessment_id===latest.id):[];
 const reviewRevision=activeReview.reduce((max,r)=>Math.max(max,r.revision),0);
 return <>
  <div className="section-eyebrow">AF-042 A AF-050 · AVALIAÇÃO MUNICIPAL</div>
  <div className="page-heading"><div><h1>{item.title}</h1>
   <p>{item.kind==='idea'?'Ideia inicial sem vínculo obrigatório a projeto':
    'Projeto documentado: '+(item.project_title??'Projeto não identificado')}</p></div>
   <div className="radar-actions"><Link href="/avaliador" className="btn btn-outline">Voltar ao avaliador</Link>
   {item.project_id&&<Link href={'/projetos/'+item.project_id} className="btn btn-outline">Abrir projeto</Link>}</div></div>
  <p className="note"><strong>Uso interno e preliminar.</strong> Uma nota alta não elimina
   impedimentos legais, documentais ou financeiros; nenhuma avaliação tem efeito
   sobre elegibilidade, contratação, financiamento ou decisão de órgão público.</p>
  {!enabled&&<p className="demo-notice">Módulo em homologação: gravações desabilitadas.</p>}
  <section className="panel"><h2>Contexto informado pelo proponente</h2>
   <dl className="project-details">
    <div className="profile-row"><dt>Problema</dt><dd>{item.problem}</dd></div>
    <div className="profile-row"><dt>Público</dt><dd>{item.target_audience}</dd></div>
    <div className="profile-row"><dt>Objetivo</dt><dd>{item.objective}</dd></div>
    <div className="profile-row"><dt>Registro</dt><dd>{item.author_name} · {stamp(item.created_at)}</dd></div>
   </dl>
  </section>
  {item.kind==='documented'&&<section className="panel">
   <h2>AF-043 · Evidências documentais vinculadas ({evidence.length})</h2>
   <p>Somente versões de arquivos do próprio projeto e município; nenhum
    anexo é transferido a outro município. Inclusões não substituem versões anteriores.</p>
   {!evidence.length&&<p className="muted">Vincule ao menos uma versão antes da primeira avaliação.</p>}
   {evidence.map(x=><p key={x.id}>{x.item_title} · {x.file_name} · v{x.version}
    {' '}<small>SHA-256: <code>{x.sha256}</code></small><span className="help"> · {x.note}</span></p>)}
   {canWrite&&versions.length>0&&<ReadinessEvidenceLink caseId={id} versions={versions}/>}
   {versions.length===0&&item.project_id&&<p><Link href={'/projetos/'+item.project_id+'/documentos'}>
    Prepare primeiro o checklist e anexe versões documentais ao projeto.</Link></p>}
  </section>}
  <section className="panel">
   <h2>AF-044/045 · Avaliação ponderada e versionada</h2>
   {rubrics.length===0&&<p className="note">Solicite ao administrador municipal o registro de uma rubrica
    em <Link href="/avaliador">Avaliador</Link>.</p>}
   {canWrite&&rubrics.length>0&&(item.kind==='idea'||evidence.length>0)&&
    <details><summary>Registrar avaliação ou reavaliação (nova versão)</summary>
     <ReadinessAssessmentCreate caseId={id} rubrics={rubrics}
      expectedRevision={latest?.revision??0}/></details>}
   {!assessments.length&&<p className="muted">Nenhuma avaliação registrada.</p>}
   {assessments.map((a,i)=><article key={a.id} className="review-event">
    <span className="chip">Avaliação v{a.revision} · {a.score}/100</span>
    <h3>{i===0?'Avaliação atual':'Avaliação histórica'}</h3>
    <p>Autor: {a.author_name} · {stamp(a.created_at)} ·
     {' '}{a.evaluated_weight}% da rubrica com notas declaradas.
     {' '}Limite com pendências: {a.maximum_possible_score}/100.</p>
    <p><strong>Justificativa:</strong> {a.revision_note}</p>
    <p>Rubrica: versão {a.rubric_version} ·
     {' '}<code>{a.snapshot_sha256}</code> (hash do snapshot de metadados)</p>
    <p>Evidências documentais congeladas: {a.evidence_snapshot.length}.
     {' '}Impedimentos declarados: {a.blockers_snapshot.length}.</p>
    <ul>{a.scores_snapshot.map(s=><li key={s.id}>
     {a.rubric_snapshot.find(c=>c.id===s.id)?.label??s.id}:
     {' '}{s.score===null?'Não avaliado (sem nota)':s.score+'/100'}
     {s.evidence&&<span> — {s.evidence}</span>}
    </li>)}</ul>
    {a.blockers_snapshot.length>0&&<div className="demo-notice">
     <strong>Impedimentos potenciais, separados da nota</strong>
     <ul>{a.blockers_snapshot.map(b=><li key={b.code}>
      {b.rule}: {b.evidence}</li>)}</ul>
    </div>}
    <p><Link href={'/api/readiness/cases/'+id+'/report?assessmentId='+a.id}
     target="_blank" rel="noopener noreferrer">
     Relatório PDF desta versão</Link></p>
    {i===0&&<section><h3>AF-047 · Ações priorizadas</h3>
     {a.action_plan_snapshot.length===0&&<p className="muted">Nenhuma lacuna registrada pelo motor.</p>}
     {a.action_plan_snapshot.map(action=>{
      const assigned=assignments.find(x=>x.action_code===action.id);
      return <div className="review-event" key={action.id}>
       <span className="chip">{action.priority}</span>
       <p><strong>{action.reason}</strong> · potencial indicativo {action.impact.toFixed(2)} pontos</p>
       <p>{action.recommendation}</p>
       {assigned&&<p>Responsável: {assigned.responsible_name} · revisão {assigned.revision}</p>}
       {canWrite&&<details><summary>{assigned?'Reatribuir':'Atribuir'} responsável</summary>
        <ReadinessActionAssign assessmentId={a.id} actionCode={action.id}
         users={people} expectedRevision={assigned?.revision??0}/></details>}
      </div>;
     })}
     <h3>AF-048 · Simulação não persistente</h3>
     <ReadinessSimulator rubric={a.rubric_snapshot} scores={a.scores_snapshot}
      blockers={a.blockers_snapshot} originalScore={Number(a.score)}/>
     <h3>AF-049 · Revisão de terceiro</h3>
     {activeReview.map(e=><p key={e.id}>{e.decision} · {e.reviewer_name} ·
      {' '}{stamp(e.reviewed_at)} · {e.note}</p>)}
     {canReview&&<ReadinessReviewForm assessmentId={a.id}
      expectedRevision={reviewRevision}/>}
    </section>}
   </article>)}
  </section>
  {reviews.length>0&&<section className="panel"><h2>Histórico de revisão por versão</h2>
   {reviews.map(r=><p key={r.id}>Avaliação {r.assessment_id.slice(0,8)} ·
    {' '}{r.decision} · revisão {r.revision} · {r.reviewer_name} · {r.note}</p>)}
  </section>}
 </>;
}
