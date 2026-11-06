import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {formatBRLCents} from '@/lib/financial-money.mjs';
import {formatQuantityMilli} from '@/lib/budget-math.mjs';
import {READ_BUDGET_STAGES_SQL,READ_BUDGET_TOTAL_SQL} from '@/lib/project-budget-sql.mjs';
import {BudgetStageForm,BudgetItemForm} from '@/components/project-budget-forms';
import {CounterpartSimulation} from '@/components/counterpart-simulation';

export const dynamic='force-dynamic';
type Project={id:string;title:string;owner_user_id:string|null;is_example:boolean|null};
type Stage={id:string;stage_number:number;title:string;starts_on:string;ends_on:string;
 assumptions:string;created_at:string;author_name:string;item_count:number;subtotal_cents:string};
type Item={id:string;stage_id:string;line_number:number;title:string;unit:string;
 quantity_milli:string;unit_cost_cents:string;line_total_cents:string;
 assumptions:string;created_at:string;author_name:string};
type Total={item_count:number;total_cents:string};
export default async function ProjectBudget({params}:{params:Promise<{id:string}>}){
 const user=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(user.municipality_id,
  'SELECT p.id,p.title,p.owner_user_id,o.is_example FROM projects p '+
  'LEFT JOIN opportunities o ON o.id=p.opportunity_id '+
  'WHERE p.id=$1 AND p.municipality_id=$2',[id,user.municipality_id],user.id);
 if(!project)notFound();
 const [stages,items,totals]=await Promise.all([
  queryForMunicipality<Stage>(user.municipality_id,READ_BUDGET_STAGES_SQL,
   [user.municipality_id,id],user.id),
  queryForMunicipality<Item>(user.municipality_id,
   'SELECT i.id,i.stage_id,i.line_number,i.title,i.unit,i.quantity_milli,'+
   'i.unit_cost_cents,i.line_total_cents,i.assumptions,i.created_at,'+
   'u.full_name AS author_name FROM project_budget_items i '+
   'JOIN users u ON u.id=i.created_by AND u.municipality_id=i.municipality_id '+
   'WHERE i.municipality_id=$1 AND i.project_id=$2 '+
   'ORDER BY i.stage_id,i.line_number,i.id LIMIT 400',
   [user.municipality_id,id],user.id),
  queryForMunicipality<Total>(user.municipality_id,READ_BUDGET_TOTAL_SQL,
   [user.municipality_id,id],user.id)
 ]);
 const total=totals[0]??{item_count:0,total_cents:'0'};
 const sumOfStages=stages.reduce((n,s)=>n+BigInt(s.subtotal_cents),0n);
 const reconciled=sumOfStages===BigInt(total.total_cents);
 const enabled=process.env.ENABLE_PROJECT_BUDGET==='yes';
 const canWrite=enabled&&!project.is_example&&
  (user.role==='admin'||user.id===project.owner_user_id);
 const date=(value:string)=>value.split('-').reverse().join('/');
 const time=(value:string)=>new Date(value).toLocaleString('pt-BR',{
  timeZone:'America/Sao_Paulo'});
 return <>
  <div className="section-eyebrow">PLANEJAMENTO FÍSICO-FINANCEIRO · AF-025</div>
  <div className="page-heading">
   <div><h1>Orçamento por etapas</h1><p>{project.title}</p></div>
   <div className="radar-actions">
    <Link href={'/projetos/'+id+'/financeiro'} className="btn btn-outline">Repasses</Link>
    <Link href={'/projetos/'+id} className="btn btn-outline">Voltar ao projeto</Link>
   </div>
  </div>
  {project.is_example&&<p className="demo-notice">Projeto vinculado a oportunidade fictícia:
   cadastro orçamentário bloqueado.</p>}
  <section className="panel">
   <h2>Consolidação declarada</h2>
   <dl className="project-details">
    <div className="profile-row"><dt>Etapas</dt><dd>{stages.length}</dd></div>
    <div className="profile-row"><dt>Itens lançados</dt><dd>{total.item_count}</dd></div>
    <div className="profile-row"><dt>Total do orçamento</dt>
     <dd><strong>{formatBRLCents(total.total_cents)}</strong></dd></div>
    <div className="profile-row"><dt>Soma dos subtotais por etapa</dt>
     <dd><strong>{formatBRLCents(sumOfStages)}</strong></dd></div>
    <div className="profile-row"><dt>Conferência dos totais</dt>
     <dd>{reconciled?'Conciliado entre etapas e itens':'Diferença transitória: atualizar página e conferir lançamentos'}</dd>
    </div>
   </dl>
   <p className="help">Quantidade informada até três casas decimais; custo unitário até
    dois centavos decimais. Cada item arredonda para o centavo mais próximo,
    metade para cima. Todos os valores são estimativas municipais, não
    constituem licitação, cotação vigente ou validação de preço público.</p>
  </section>
  <CounterpartSimulation key={id+'/'+total.total_cents} totalCents={total.total_cents}
   itemCount={total.item_count} isExample={project.is_example===true}/>
  <section className="panel">
   <h2>Cadastrar etapa</h2>
   {canWrite?<BudgetStageForm projectId={id}/>:
    <p className="muted">Cadastro desabilitado até homologação ou por falta de
     titularidade/permissão administrativa.</p>}
  </section>
  <section className="panel">
   <h2>Adicionar item físico-financeiro</h2>
   {canWrite&&stages.length>0?
    <BudgetItemForm projectId={id} stages={stages.map(s=>({
     id:s.id,stage_number:s.stage_number,title:s.title
    }))}/>:
    <p className="muted">Cadastre uma etapa para incluir os itens. O lançamento
     depende da ativação e das permissões do projeto.</p>}
  </section>
  <section className="panel">
   <h2>Quadro por etapas ({stages.length})</h2>
   {!stages.length&&<p className="muted">Ainda não foram cadastradas etapas.</p>}
   <div className="review-events">{stages.map(stage=>{
    const shown=items.filter(i=>i.stage_id===stage.id);
    return <article key={stage.id} className="review-event">
     <span className="chip">Etapa {stage.stage_number}</span>
     <h3>{stage.title}</h3>
     <p><strong>Prazo previsto:</strong> {date(stage.starts_on)} a {date(stage.ends_on)}</p>
     <p><strong>Premissas:</strong> {stage.assumptions}</p>
     <p><strong>Subtotal:</strong> {formatBRLCents(stage.subtotal_cents)} ·
      {' '}{stage.item_count} itens</p>
     <p className="help">Registrada por {stage.author_name} em {time(stage.created_at)}</p>
     {shown.map(item=><div key={item.id} className="profile-row">
      <p><strong>{item.line_number}. {item.title}</strong> ·
       {' '}{formatQuantityMilli(item.quantity_milli)} {item.unit} ×
       {' '}{formatBRLCents(item.unit_cost_cents)} =
       {' '}{formatBRLCents(item.line_total_cents)}</p>
      <p className="help">Premissas: {item.assumptions} ·
       {' '}{item.author_name} · {time(item.created_at)}</p>
     </div>)}
     {shown.length<stage.item_count&&<p className="note">Existem itens adicionais
      não exibidos nesta lista; subtotal inclui todos os lançamentos.</p>}
    </article>;
   })}</div>
   {items.length===400&&<p className="note">Exibição limitada aos primeiros 400
    itens; totais e subtotais incluem todos os registros.</p>}
  </section>
 </>;
}
