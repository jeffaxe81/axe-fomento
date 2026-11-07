import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {REVIEW_READINESS_SQL} from '@/lib/internal-review-sql.mjs';
import {InternalReviewActions} from '@/components/internal-review-actions';
export const dynamic='force-dynamic';
type Project={id:string;title:string;owner_user_id:string|null;
 opportunity_title:string|null;is_example:boolean|null;status:string};
type Review={state:'em_revisao'|'revisada'|'devolvida'|'autorizada';revision:number;
 submitted_by:string;technically_reviewed_by:string|null;authorized_by:string|null;
 submitted_at:string;technically_reviewed_at:string|null;authorized_at:string|null};
type Gate={has_checklist:boolean;pending_documents:number;open_tasks:number;
 mandatory_requirements_missing:number};
type Event={revision:number;action:string;note:string;actor_name:string;recorded_at:string};
const stateLabel:Record<string,string>={
 em_revisao:'Em revisão técnica',revisada:'Revisão técnica aprovada',
 devolvida:'Devolvida para correções',autorizada:'Autorizada internamente',
};
const actionLabel:Record<string,string>={
 submitted:'Envio à revisão',resubmitted:'Reenvio à revisão',
 technical_approved:'Revisão técnica aprovada',returned:'Devolução para correções',
 authorized:'Autorização interna',
};
export default async function InternalProjectReview({params}:{params:Promise<{id:string}>}){
 const user=await requireSession();
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(user.municipality_id,
   'SELECT p.id,p.title,p.owner_user_id,p.status,o.title AS opportunity_title,'+
   'o.is_example FROM projects p LEFT JOIN opportunities o ON o.id=p.opportunity_id '+
   'WHERE p.id=$1 AND p.municipality_id=$2',
   [id,user.municipality_id],user.id);
 if(!project)notFound();
 const [reviewRows,gates,events]=await Promise.all([
  queryForMunicipality<Review>(user.municipality_id,
   'SELECT state,revision,submitted_by,technically_reviewed_by,authorized_by,'+
   'submitted_at,technically_reviewed_at,authorized_at FROM project_internal_reviews '+
   'WHERE project_id=$1 AND municipality_id=$2',
   [id,user.municipality_id],user.id),
  queryForMunicipality<Gate>(user.municipality_id,REVIEW_READINESS_SQL,
   [user.municipality_id,id],user.id),
  queryForMunicipality<Event>(user.municipality_id,
   'SELECT e.revision,e.action,e.note,e.recorded_at,u.full_name AS actor_name '+
   'FROM project_internal_review_events e JOIN users u '+
   'ON u.id=e.actor_id AND u.municipality_id=e.municipality_id '+
   'WHERE e.project_id=$1 AND e.municipality_id=$2 ORDER BY e.revision DESC LIMIT 100',
   [id,user.municipality_id],user.id),
 ]);
 const review=reviewRows[0]??null;
 const gate=gates[0];
 const ready=!!gate?.has_checklist&&gate.pending_documents===0&&
   gate.open_tasks===0&&gate.mandatory_requirements_missing===0;
 const state=review?.state??'sem_revisao';
 const canSubmit=user.role==='admin'||project.owner_user_id===user.id;
 const canReview=user.role==='admin'&&!!review&&review.submitted_by!==user.id;
 const canAuthorize=canReview&&!!review?.technically_reviewed_by&&
   review.technically_reviewed_by!==user.id;
 return <>
  <div className="section-eyebrow">GOVERNANÇA DA CANDIDATURA</div>
  <div className="page-heading">
   <div><h1>Revisão e autorização interna</h1>
    <p>{project.title} · {project.opportunity_title??'Sem oportunidade vinculada'}</p>
   </div>
   <div className="radar-actions">
    <Link href="/revisoes" className="btn btn-outline">Fila de revisões</Link>
    <Link href={'/projetos/'+id} className="btn btn-outline">Voltar ao projeto</Link>
   </div>
  </div>
  {project.is_example&&<p className="demo-notice">
   <strong>FICTÍCIO / TESTE:</strong> a oportunidade de origem é ilustrativa.</p>}
  <section className="panel">
   <h2>Estado da decisão interna</h2>
   <div className="review-state">
    <strong>{review?stateLabel[review.state]:'Não enviado para revisão'}</strong>
    <span>{review?'Revisão '+review.revision:'Sem decisão cadastrada'}</span>
   </div>
   <p className="help">A autorização significa apenas aceite interno da equipe municipal.
    Ela <strong>não protocola</strong> nem envia a proposta a portais externos e não
    altera a situação de submissão da candidatura automaticamente.</p>
   {review?.authorized_at&&<p className="success">
    Autorização registrada em {new Date(review.authorized_at).toLocaleString('pt-BR',
     {timeZone:'America/Sao_Paulo'})}.
   </p>}
  </section>
  <section className="panel">
   <h2>Verificação preliminar antes da aprovação</h2>
   <p className="help">Os indicadores abaixo são baseados no controle municipal. Não
    comprovam habilitação jurídica nem substituem análise do instrumento oficial.</p>
   <div className="requirement-stats">
    <div><strong>{gate?.has_checklist?'Sim':'Não'}</strong><span>Checklist criado</span></div>
    <div><strong>{gate?.pending_documents??'—'}</strong><span>Documentos pendentes</span></div>
    <div><strong>{gate?.open_tasks??'—'}</strong><span>Tarefas abertas</span></div>
    <div><strong>{gate?.mandatory_requirements_missing??'—'}</strong>
     <span>Requisitos obrigatórios sem atendimento registrado</span></div>
   </div>
   <div className="radar-actions review-links">
    <Link href={'/projetos/'+id+'/documentos'} className="btn btn-outline">Checklist documental</Link>
    <Link href={'/projetos/'+id+'/tarefas'} className="btn btn-outline">Tarefas do projeto</Link>
    <Link href={'/projetos/'+id+'/requisitos'} className="btn btn-outline">Matriz de requisitos</Link>
   </div>
   {!ready&&<p className="note">A aprovação técnica e a autorização interna não
    podem avançar enquanto houver impedimentos nesta lista.</p>}
  </section>
  <section className="panel">
   <h2>Registrar decisão</h2>
   <p className="help">O responsável pelo projeto, ou um administrador, pode enviar e reenviar
    a candidatura. A revisão técnica exige outro administrador; a autorização final exige
    um administrador diferente do solicitante e do revisor técnico.</p>
   {state==='autorizada'?<p className="success">Fluxo interno encerrado e registrado. O
    protocolo externo, quando aplicável, deverá ser realizado separadamente.</p>:
    <InternalReviewActions key={id+'-'+(review?.revision??0)}
     projectId={id} state={state} revision={review?.revision??0} ready={ready}
     canSubmit={canSubmit} canReview={canReview} canAuthorize={canAuthorize}/>}
  </section>
  <section className="panel">
   <h2>Histórico de decisões</h2>
   {events.length?<div className="review-events">
    {events.map(event=><article className="review-event" key={event.revision}>
     <strong>v{event.revision} — {actionLabel[event.action]??event.action}</strong>
     <p>{event.actor_name} · {new Date(event.recorded_at).toLocaleString('pt-BR',
      {timeZone:'America/Sao_Paulo'})}</p>
     <p>{event.note}</p>
    </article>)}
   </div>:<p className="muted">Nenhuma revisão registrada neste projeto.</p>}
   {events.length===100&&<p className="note">Histórico limitado aos 100 registros mais recentes.</p>}
  </section>
 </>;
}
