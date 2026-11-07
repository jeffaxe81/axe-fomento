import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { todaySaoPaulo,daysToExpiry } from '@/lib/document-validity.mjs';
export const dynamic='force-dynamic';
type Row={
 id:string;project_id:string;project_name:string;title:string;
 status:'pendente'|'em_andamento'|'concluida'|'cancelada';
 secretariat_name:string;assigned_to:string;assignee_name:string;due_on:string;
};
const states={pendente:'Pendente',em_andamento:'Em andamento',concluida:'Concluída',cancelada:'Cancelada'};
export default async function TasksDashboard({searchParams}:{
 searchParams:Promise<{escopo?:string}>;
}){
 const user=await requireSession();
 const {escopo}=await searchParams;
 const showAll=user.role==='admin'&&escopo==='todas';
 const today=todaySaoPaulo();
 const rows=await queryForMunicipality<Row>(user.municipality_id,
  "SELECT t.id,t.project_id,p.title AS project_name,t.title,t.status,"+
  "s.name AS secretariat_name,t.assigned_to,u.full_name AS assignee_name,"+
  "to_char(t.due_on,'YYYY-MM-DD') AS due_on "+
  "FROM municipal_tasks t JOIN projects p ON p.id=t.project_id AND p.municipality_id=t.municipality_id "+
  "JOIN municipal_secretariats s ON s.id=t.secretariat_id AND s.municipality_id=t.municipality_id "+
  "JOIN users u ON u.id=t.assigned_to AND u.municipality_id=t.municipality_id "+
  "WHERE t.municipality_id=$1 AND ($2::uuid IS NULL OR t.assigned_to=$2::uuid) "+
  "ORDER BY CASE WHEN t.status IN ('concluida','cancelada') THEN 1 ELSE 0 END,t.due_on,t.id LIMIT 200",
  [user.municipality_id,showAll?null:user.id],user.id);
 const overdue=rows.filter(x=>!['concluida','cancelada'].includes(x.status)&&
   (daysToExpiry(x.due_on,today)??0)<0).length;
 const active=rows.filter(x=>['pendente','em_andamento'].includes(x.status)).length;
 return <>
  <div className="section-eyebrow">OPERAÇÃO MUNICIPAL DE CANDIDATURAS</div>
  <div className="page-heading">
   <div><h1>{showAll?'Tarefas municipais':'Minhas tarefas'}</h1>
    <p>Atividades, secretarias responsáveis, prazos e pendências dos projetos municipais.</p></div>
   {user.role==='admin'&&<Link href="/administracao/secretarias" className="btn btn-outline">
    Gerenciar secretarias</Link>}
  </div>
  <section className="panel">
   <div className="requirement-stats">
    <div><strong>{active}</strong><span>Em aberto na lista</span></div>
    <div><strong>{overdue}</strong><span>Prazo vencido</span></div>
    <div><strong>{rows.length}</strong><span>Tarefas exibidas</span></div>
   </div>
   {user.role==='admin'&&<nav className="expiry-filters" aria-label="Escopo das tarefas">
    <Link href="/tarefas" aria-current={!showAll?'page':undefined}>Minhas tarefas</Link>
    <Link href="/tarefas?escopo=todas" aria-current={showAll?'page':undefined}>
     Todas as tarefas do município</Link>
   </nav>}
   <p className="help">A conclusão é uma declaração da equipe; não equivale à aprovação externa.
    Datas calculadas conforme o fuso de Brasília. Nenhum lembrete automático é disparado.</p>
  </section>
  <section className="panel">
   <h2>Lista de tarefas</h2>
   {rows.length?<div className="expiry-rows">
    {rows.map(item=>{
     const days=daysToExpiry(item.due_on,today);
     const late=days!==null&&days<0&&!['concluida','cancelada'].includes(item.status);
     return <article key={item.id} className="expiry-entry">
      <div className="small-tags">
       <span className="chip">{states[item.status]}</span>
       <span className="chip">{item.secretariat_name}</span>
       {late&&<span className="chip">Vencida há {-days} dia(s)</span>}
      </div>
      <h3><Link href={'/projetos/'+item.project_id+'/tarefas'}>
       {item.project_name} — {item.title}</Link></h3>
      <p><strong>Responsável:</strong> {item.assignee_name}</p>
      <p><strong>Prazo:</strong> {item.due_on.split('-').reverse().join('/')}</p>
     </article>;
    })}
   </div>:<p className="muted">Nenhuma tarefa encontrada neste escopo.</p>}
   {rows.length===200&&<p className="note">Esta lista mostra até 200 tarefas;
    a visão pode estar incompleta. Consulte também os projetos.</p>}
  </section>
 </>;
}
