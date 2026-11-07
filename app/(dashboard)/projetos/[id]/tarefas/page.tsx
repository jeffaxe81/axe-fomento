import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { todaySaoPaulo,daysToExpiry } from '@/lib/document-validity.mjs';
import { MunicipalTaskCreate } from '@/components/municipal-task-create';
import { MunicipalTaskChange } from '@/components/municipal-task-change';

export const dynamic='force-dynamic';
type Project={id:string;title:string};
type Secretariat={id:string;name:string};
type Member={secretariat_id:string;user_id:string;full_name:string};
type Task={
 id:string;title:string;details:string;due_on:string;status:'pendente'|'em_andamento'|'concluida'|'cancelada';
 secretariat_id:string;secretariat_name:string;assigned_to:string;assignee_name:string;
 assignee_active:boolean;revision:number;
};
type TaskEvent={
 task_id:string;event_type:string;revision:number;note:string;recorded_at:string;
 actor_name:string;previous_name:string|null;next_name:string|null;
 previous_status:string|null;next_status:string|null;
 previous_due_on:string|null;next_due_on:string|null;
};
const statusLabels={
 pendente:'Pendente',em_andamento:'Em andamento',
 concluida:'Concluída',cancelada:'Cancelada',
};
const eventLabels:Record<string,string>={
 created:'Tarefa criada',transferred:'Responsável transferido',
 status_changed:'Situação alterada',deadline_changed:'Prazo alterado',
};
export default async function MunicipalProjectTasks({params}:{
 params:Promise<{id:string}>;
}){
 const user=await requireSession();
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(user.municipality_id,
  'SELECT id,title FROM projects WHERE municipality_id=$1 AND id=$2',
  [user.municipality_id,id],user.id);
 if(!project)notFound();
 const [secretariats,members,tasks,events]=await Promise.all([
  queryForMunicipality<Secretariat>(user.municipality_id,
   'SELECT id,name FROM municipal_secretariats WHERE municipality_id=$1 ORDER BY name,id LIMIT 100',
   [user.municipality_id],user.id),
  queryForMunicipality<Member>(user.municipality_id,
   'SELECT m.secretariat_id,m.user_id,u.full_name FROM municipal_secretariat_members m '+
   'JOIN users u ON u.id=m.user_id AND u.municipality_id=m.municipality_id AND u.active=true '+
   'WHERE m.municipality_id=$1 AND m.revoked_at IS NULL ORDER BY u.full_name,m.secretariat_id LIMIT 500',
   [user.municipality_id],user.id),
  queryForMunicipality<Task>(user.municipality_id,
   "SELECT t.id,t.title,t.details,to_char(t.due_on,'YYYY-MM-DD') AS due_on,t.status,"+
   't.secretariat_id,s.name AS secretariat_name,t.assigned_to,u.full_name AS assignee_name,'+
   'u.active AS assignee_active,t.revision FROM municipal_tasks t '+
   'JOIN municipal_secretariats s ON s.id=t.secretariat_id AND s.municipality_id=t.municipality_id '+
   'JOIN users u ON u.id=t.assigned_to AND u.municipality_id=t.municipality_id '+
   'WHERE t.project_id=$1 AND t.municipality_id=$2 ORDER BY t.due_on,t.id LIMIT 200',
   [id,user.municipality_id],user.id),
  queryForMunicipality<TaskEvent>(user.municipality_id,
   "SELECT e.task_id,e.event_type,e.revision,e.note,e.recorded_at,"+
   "actor.full_name AS actor_name,prev.full_name AS previous_name,"+
   "next.full_name AS next_name,e.previous_status,e.next_status,"+
   "to_char(e.previous_due_on,'YYYY-MM-DD') AS previous_due_on,"+
   "to_char(e.next_due_on,'YYYY-MM-DD') AS next_due_on "+
   'FROM municipal_task_events e '+
   'JOIN users actor ON actor.id=e.actor_id AND actor.municipality_id=e.municipality_id '+
   'LEFT JOIN users prev ON prev.id=e.previous_assignee AND prev.municipality_id=e.municipality_id '+
   'LEFT JOIN users next ON next.id=e.next_assignee AND next.municipality_id=e.municipality_id '+
   'WHERE e.project_id=$1 AND e.municipality_id=$2 '+
   'ORDER BY e.recorded_at DESC,e.id DESC LIMIT 300',
   [id,user.municipality_id],user.id),
 ]);
 const today=todaySaoPaulo();
 const counts={pendente:0,em_andamento:0,concluida:0,cancelada:0};
 for(const task of tasks)counts[task.status]++;
 const byTask=new Map<string,TaskEvent[]>();
 for(const event of events){
  const row=byTask.get(event.task_id)||[];
  row.push(event);byTask.set(event.task_id,row);
 }
 return <>
  <div className="section-eyebrow">DISTRIBUIÇÃO DE TRABALHO MUNICIPAL</div>
  <div className="page-heading">
   <div><h1>Tarefas do projeto</h1><p>{project.title}</p></div>
   <div className="radar-actions">
    <Link href="/tarefas" className="btn btn-outline">Central de tarefas</Link>
    <Link href={'/projetos/'+id} className="btn btn-outline">← Voltar ao projeto</Link>
   </div>
  </div>
  <section className="panel">
   <h2>Andamento das atividades</h2>
   <div className="requirement-stats">
    <div><strong>{counts.pendente}</strong><span>Pendentes</span></div>
    <div><strong>{counts.em_andamento}</strong><span>Em andamento</span></div>
    <div><strong>{counts.concluida}</strong><span>Concluídas</span></div>
   </div>
   <p className="help">Tarefas atribuídas a integrantes autorizados de secretarias.
    As etapas são geridas pela prefeitura e não representam aprovação externa de candidatura.</p>
  </section>
  {user.role==='admin'&&<MunicipalTaskCreate
   projectId={id} secretariats={secretariats} members={members}/>}
  <section className="panel municipal-task-list">
   <h2>Atividades por responsável</h2>
   {tasks.length?tasks.map(task=>{
     const remaining=daysToExpiry(task.due_on,today);
     const canUpdateStatus=user.role==='admin'||(task.assigned_to===user.id&&task.assignee_active&&
      members.some(member=>member.user_id===user.id&&member.secretariat_id===task.secretariat_id));
     const history=byTask.get(task.id)||[];
     return <article className="municipal-task" key={task.id}>
      <div className="small-tags">
       <span className="chip">{statusLabels[task.status]}</span>
       <span className="chip">{task.secretariat_name}</span>
       {task.status!=='concluida'&&task.status!=='cancelada'&&remaining!==null&&remaining<0&&
        <span className="chip">Prazo vencido há {-remaining} dia(s)</span>}
      </div>
      <h3>{task.title}</h3>
      {task.details&&<p className="task-description">{task.details}</p>}
      <dl className="task-summary">
       <div><dt>Responsável</dt><dd>{task.assignee_name}
        {!task.assignee_active?' — conta desativada; reatribuir':''}</dd></div>
       <div><dt>Prazo</dt><dd>{task.due_on.split('-').reverse().join('/')}</dd></div>
       <div><dt>Revisão</dt><dd>{task.revision}</dd></div>
      </dl>
      <MunicipalTaskChange key={task.id+'-'+task.revision} taskId={task.id}
       initialStatus={task.status} initialDue={task.due_on}
       initialAssignee={task.assigned_to} initialRevision={task.revision}
       secretariatId={task.secretariat_id} members={members}
       canManage={user.role==='admin'} canUpdateStatus={canUpdateStatus}/>
      <details className="task-audit">
       <summary>Histórico de alterações ({history.length} recente(s))</summary>
       {history.map(event=><div className="task-event" key={event.revision}>
        <strong>v{event.revision} — {eventLabels[event.event_type]??event.event_type}</strong>
        <p>{event.actor_name} · {new Date(event.recorded_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
        {event.event_type==='transferred'&&
         <p>{event.previous_name??'Sem responsável'} → {event.next_name??'Sem responsável'}</p>}
        {event.event_type==='status_changed'&&
         <p>{event.previous_status??'—'} → {event.next_status??'—'}</p>}
        {event.event_type==='deadline_changed'&&
         <p>{event.previous_due_on??'—'} → {event.next_due_on??'—'}</p>}
        <p>{event.note}</p>
       </div>)}
      </details>
     </article>;
   }):<p className="muted">Nenhuma tarefa foi distribuída para este projeto.</p>}
   {tasks.length===200&&<p className="note">A página exibe no máximo 200 tarefas;
     pode haver outras tarefas neste projeto.</p>}
   {events.length===300&&<p className="note">Histórico limitado às 300 alterações mais recentes deste projeto.</p>}
  </section>
 </>;
}
