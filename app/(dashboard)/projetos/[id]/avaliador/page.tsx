import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {ReadinessWorkspace} from '@/components/readiness-workspace';
export const dynamic='force-dynamic';
type Criterion={id:string;label:string;weight:number};
type Idea={id:string;version:number;problem:string;audience:string;objective:string;created_at:string};
type Rubric={id:string;version:number;criteria:Criterion[];note:string;created_at:string};
type Evidence={id:string;kind:'document'|'budget';document_version_id:string|null;budget_item_id:string|null;
 title:string;snapshot_sha256:string;note:string};
type Source={id:string;title:string};
type Assessment={id:string;version:number;stage:string;result_snapshot:{score:number;maximumPossibleScore:number;
 evaluatedWeight:number;breakdown:Array<{id:string;label:string;score:number|null;evidence:string|null;weight:number}>};
 criteria_input:Array<{id:string;score:number|null;evidence:string|null}>;
 blockers:Array<{id:string;title:string;ruleUrl:string;evidence:string;confirmed:boolean}>;
 actions:Array<{key:string;title:string;priority:string;reason:string}>;
 snapshot_sha256:string;note:string;created_at:string;created_by:string;
 previous_assessment_id:string|null;rubric_id:string};
type Review={assessment_id:string;revision:number;decision:string;note:string;reviewer_name:string;reviewed_at:string};
type Assignment={assessment_id:string;action_key:string;revision:number;assigned_to:string|null;note:string};
type Member={id:string;full_name:string};
export default async function ProjectReadiness({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<{id:string;title:string;owner_user_id:string|null}>(
  actor.municipality_id,'SELECT id,title,owner_user_id FROM projects WHERE id=$1 AND municipality_id=$2',
  [id,actor.municipality_id],actor.id);
 if(!project)notFound();
 const [ideas,rubrics,evidence,documents,budgets,assessments,reviews,assignments,members]=await Promise.all([
  queryForMunicipality<Idea>(actor.municipality_id,
   'SELECT id,version,problem,audience,objective,created_at FROM project_readiness_ideas WHERE municipality_id=$1 AND project_id=$2 ORDER BY version DESC LIMIT 50',
   [actor.municipality_id,id],actor.id),
  queryForMunicipality<Rubric>(actor.municipality_id,
   'SELECT id,version,criteria,note,created_at FROM municipal_readiness_rubrics WHERE municipality_id=$1 ORDER BY version DESC LIMIT 50',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Evidence>(actor.municipality_id,
   'SELECT id,kind,document_version_id,budget_item_id,title,snapshot_sha256,note FROM project_readiness_evidence WHERE municipality_id=$1 AND project_id=$2 ORDER BY created_at,id LIMIT 100',
   [actor.municipality_id,id],actor.id),
  queryForMunicipality<Source>(actor.municipality_id,
   "SELECT v.id,d.title || ' — versão ' || v.version AS title FROM project_document_versions v JOIN project_document_items d ON d.id=v.item_id AND d.project_id=v.project_id AND d.municipality_id=v.municipality_id WHERE v.municipality_id=$1 AND v.project_id=$2 ORDER BY d.title,v.version DESC LIMIT 100",
   [actor.municipality_id,id],actor.id),
  queryForMunicipality<Source>(actor.municipality_id,
   'SELECT id,title FROM project_budget_items WHERE municipality_id=$1 AND project_id=$2 ORDER BY title,id LIMIT 100',
   [actor.municipality_id,id],actor.id),
  queryForMunicipality<Assessment>(actor.municipality_id,
   'SELECT id,version,stage,result_snapshot,criteria_input,blockers,actions,snapshot_sha256,note,created_at,created_by,previous_assessment_id,rubric_id FROM project_readiness_assessments WHERE municipality_id=$1 AND project_id=$2 ORDER BY version DESC LIMIT 50',
   [actor.municipality_id,id],actor.id),
  queryForMunicipality<Review>(actor.municipality_id,
   'SELECT e.assessment_id,e.revision,e.decision,e.note,u.full_name AS reviewer_name,e.reviewed_at FROM readiness_review_events e JOIN users u ON u.id=e.reviewer_id AND u.municipality_id=e.municipality_id WHERE e.municipality_id=$1 AND e.project_id=$2 ORDER BY e.reviewed_at,e.id LIMIT 200',
   [actor.municipality_id,id],actor.id),
  queryForMunicipality<Assignment>(actor.municipality_id,
   'SELECT assessment_id,action_key,revision,assigned_to,note FROM readiness_action_assignment_events WHERE municipality_id=$1 AND project_id=$2 ORDER BY recorded_at,id LIMIT 200',
   [actor.municipality_id,id],actor.id),
  queryForMunicipality<Member>(actor.municipality_id,
   'SELECT id,full_name FROM users WHERE municipality_id=$1 AND active=true ORDER BY full_name LIMIT 200',
   [actor.municipality_id],actor.id)
 ]);
 const enabled=process.env.ENABLE_READINESS_EVALUATOR==='yes';
 const canWrite=enabled&&(actor.role==='admin'||project.owner_user_id===actor.id);
 const latest=assessments[0]??null;
 return <>
  <div className="section-eyebrow">AVALIADOR DE MATURIDADE · AF-042 A AF-050</div>
  <div className="page-heading"><div><h1>Pré-avaliação de projetos</h1><p>{project.title}</p></div>
   <div className="radar-actions"><Link className="btn btn-outline" href={'/projetos/'+id}>Voltar ao projeto</Link></div>
  </div>
  <section className="panel">
   <h2>Orientação e limites</h2>
   <p>Notas, critérios, evidências, impeditivos e planos são registros internos.
    Nenhuma etapa certifica viabilidade, elegibilidade jurídica, aprovação, limite de crédito
    ou protocolo em órgão externo. Informações exigem revisão humana.</p>
   {!enabled&&<p className="demo-notice">Avaliador desativado até homologação operacional.</p>}
  </section>
  <section className="panel">
   <h2>Histórico de pré-avaliações ({assessments.length})</h2>
   {!assessments.length&&<p className="muted">Nenhuma avaliação registrada.</p>}
   <div className="review-events">{assessments.map(a=><article className="review-event" key={a.id}>
    <span className="chip">Revisão {a.version} · {a.stage==='idea'?'Ideia':'Projeto documentado'}</span>
    <h3>Prontidão: {a.result_snapshot.score.toLocaleString('pt-BR')} / 100</h3>
    <p>Cobertura dos critérios: {a.result_snapshot.evaluatedWeight}% ·
     limite teórico: {a.result_snapshot.maximumPossibleScore} ·
     impedimentos confirmados: {a.blockers.filter(x=>x.confirmed).length}</p>
    <p><strong>Nota:</strong> {a.note}</p>
    {a.blockers.filter(b=>b.confirmed).map(b=><p className="note" key={b.id}>
     <strong>Impedimento separado da nota:</strong> {b.title} ·
     <a href={b.ruleUrl} target="_blank" rel="noopener noreferrer">Fonte declarada</a></p>)}
    <p><strong>Plano de correções:</strong></p>
    {a.actions.length===0?<p>Nenhuma lacuna identificada na pontuação informada.</p>:
    <ul>{a.actions.map(action=><li key={action.key}>
     {action.title} · Prioridade {action.priority} · {action.reason}
     {assignments.filter(e=>e.assessment_id===a.id&&e.action_key===action.key)
       .sort((x,y)=>y.revision-x.revision).slice(0,1).map(e=>
        <span key={e.revision}> · {e.assigned_to?
         'Responsável: '+(members.find(u=>u.id===e.assigned_to)?.full_name??'Conta indisponível'):'Sem responsável'}</span>)}
    </li>)}</ul>}
    <p className="help">SHA-256 do snapshot: <code>{a.snapshot_sha256}</code></p>
    <p><a href={'/api/projects/readiness/report/'+a.id}>Gerar relatório PDF desta versão</a></p>
    {reviews.filter(r=>r.assessment_id===a.id).map(r=><p key={r.revision} className="help">
     Revisão {r.revision} · {r.decision} · {r.reviewer_name}: {r.note}</p>)}
   </article>)}</div>
  </section>
  {canWrite&&<ReadinessWorkspace projectId={id} admin={actor.role==='admin'}
   actorId={actor.id} ideas={ideas} rubrics={rubrics} evidence={evidence}
   documents={documents} budgets={budgets} assessments={assessments}
   assignments={assignments} reviews={reviews} members={members}/>}
  {!canWrite&&<p className="muted">Alterações permitidas apenas ao administrador ou responsável pelo projeto, após homologação.</p>}
  {latest&&<p className="note">A nota da última versão não substitui pareceres técnicos e jurídicos. 
   Os registros anteriores permanecem acessíveis.</p>}
 </>;
}
