import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {todaySaoPaulo} from '@/lib/document-validity.mjs';
import {formatBRLCents,moneyDifferenceCents} from '@/lib/financial-money.mjs';
import {FinancialMilestoneCreate,FinancialMilestoneRealize} from '@/components/financial-milestones';
export const dynamic='force-dynamic';
type Project={id:string;title:string;owner_user_id:string|null};
type Protocol={id:string;protocol_number:string;portal_name:string};
type Proof={id:string;item_id:string;file_name:string;version:number;item_title:string;sha256:string};
type Milestone={id:string;kind:'repasse'|'marco';title:string;protocol_number:string;
 planned_on:string;planned_amount_cents:string;plan_note:string;
 status:'previsto'|'realizado';realized_on:string|null;realized_amount_cents:string|null;
 realization_note:string|null;proof_item_id:string|null;proof_version:number|null;
 proof_sha256:string|null;created_at:string;realized_at:string|null;
 creator_name:string;realizer_name:string|null;revision:number};
type Event={id:string;milestone_id:string;action:string;effective_on:string;amount_cents:string;
 actor_name:string;recorded_at:string;revision:number};
export default async function ProjectFinancial({params}:{params:Promise<{id:string}>}){
 const user=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(user.municipality_id,
  'SELECT id,title,owner_user_id FROM projects WHERE id=$1 AND municipality_id=$2',
  [id,user.municipality_id],user.id);
 if(!project)notFound();
 const [protocols,proofs,milestones,events]=await Promise.all([
  queryForMunicipality<Protocol>(user.municipality_id,
   'SELECT id,protocol_number,portal_name FROM project_external_protocols '+
   'WHERE project_id=$1 AND municipality_id=$2 ORDER BY recorded_at DESC,id LIMIT 100',
   [id,user.municipality_id],user.id),
  queryForMunicipality<Proof>(user.municipality_id,
   'SELECT v.id,v.item_id,v.file_name,v.version,v.sha256,d.title AS item_title '+
   'FROM project_document_versions v JOIN project_document_items d '+
   'ON d.id=v.item_id AND d.project_id=v.project_id AND d.municipality_id=v.municipality_id '+
   'WHERE v.project_id=$1 AND v.municipality_id=$2 ORDER BY d.title,v.version DESC LIMIT 200',
   [id,user.municipality_id],user.id),
  queryForMunicipality<Milestone>(user.municipality_id,
   "SELECT m.id,m.kind,m.title,p.protocol_number,"+
   "to_char(m.planned_on,'YYYY-MM-DD') AS planned_on,m.planned_amount_cents,m.plan_note,"+
   "m.status,to_char(m.realized_on,'YYYY-MM-DD') AS realized_on,m.realized_amount_cents,"+
   "m.realization_note,m.proof_item_id,m.proof_version,m.proof_sha256,m.revision,"+
   "m.created_at,m.realized_at,creator.full_name AS creator_name,"+
   "realizer.full_name AS realizer_name FROM project_financial_milestones m "+
   "JOIN project_external_protocols p ON p.id=m.protocol_id AND p.municipality_id=m.municipality_id "+
   "JOIN users creator ON creator.id=m.created_by AND creator.municipality_id=m.municipality_id "+
   "LEFT JOIN users realizer ON realizer.id=m.realized_by AND realizer.municipality_id=m.municipality_id "+
   "WHERE m.project_id=$1 AND m.municipality_id=$2 ORDER BY m.planned_on,m.id LIMIT 200",
   [id,user.municipality_id],user.id),
  queryForMunicipality<Event>(user.municipality_id,
   "SELECT e.id,e.milestone_id,e.action,e.revision,e.amount_cents,"+
   "to_char(e.effective_on,'YYYY-MM-DD') AS effective_on,e.recorded_at,"+
   "u.full_name AS actor_name FROM project_financial_milestone_events e "+
   "JOIN users u ON u.id=e.actor_id AND u.municipality_id=e.municipality_id "+
   "WHERE e.project_id=$1 AND e.municipality_id=$2 "+
   "ORDER BY e.recorded_at,e.id LIMIT 400",[id,user.municipality_id],user.id)
 ]);
 const canWrite=process.env.ENABLE_FINANCIAL_TRACKING==='yes'&&
  (user.role==='admin'||user.id===project.owner_user_id);
 const downloads=process.env.ENABLE_DOCUMENT_UPLOADS==='yes';
 const today=todaySaoPaulo();
 const date=(value:string)=>value.split('-').reverse().join('/');
 const stamp=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 const totalExpected=milestones.filter(m=>m.kind==='repasse')
  .reduce((n,m)=>n+BigInt(m.planned_amount_cents),0n);
 const totalRealized=milestones.filter(m=>m.kind==='repasse'&&m.status==='realizado')
  .reduce((n,m)=>n+BigInt(m.realized_amount_cents??'0'),0n);
 return <>
  <div className="section-eyebrow">CONTROLE FINANCEIRO DECLARADO</div>
  <div className="page-heading">
   <div><h1>Repasses e marcos financeiros</h1><p>{project.title}</p></div>
   <div className="radar-actions">
    <Link className="btn btn-outline" href={'/projetos/'+id+'/protocolos'}>Protocolos</Link>
    <Link className="btn btn-outline" href={'/projetos/'+id}>Voltar ao projeto</Link>
   </div>
  </div>
  <section className="panel">
   <h2>Resumo dos repasses declarados</h2>
   <dl className="project-details">
    <div className="profile-row"><dt>Valores previstos</dt>
     <dd>{formatBRLCents(totalExpected)}</dd></div>
    <div className="profile-row"><dt>Valores declarados como realizados</dt>
     <dd>{formatBRLCents(totalRealized)}</dd></div>
    <div className="profile-row"><dt>Saldo previsto ainda não realizado</dt>
     <dd>{formatBRLCents(milestones.filter(m=>m.kind==='repasse'&&m.status==='previsto')
      .reduce((n,m)=>n+BigInt(m.planned_amount_cents),0n))}</dd></div>
   </dl>
   <p className="note">Os totais mostram somente os registros exibidos (até 200 por projeto),
    não representam saldo bancário ou conciliação oficial. Os marcos sem repasse
    não entram na soma monetária de repasses.</p>
  </section>
  <section className="panel">
   <h2>Nova previsão</h2>
   {canWrite&&protocols.length?<FinancialMilestoneCreate projectId={id} protocols={protocols}/>:
    <p className="muted">Cadastro indisponível: recurso em homologação ou ausência de
     protocolo, titularidade ou permissão administrativa.</p>}
  </section>
  <section className="panel">
   <h2>Cronograma e histórico ({milestones.length})</h2>
   {!milestones.length&&<p className="muted">Nenhum repasse ou marco financeiro informado.</p>}
   <div className="review-events">{milestones.map(m=><article key={m.id} className="review-event">
    <span className="chip">{m.kind==='repasse'?'Repasse':'Marco'} ·
     {' '}{m.status==='previsto'?(m.planned_on<today?'Prazo informado ultrapassado':'Previsto'):
      'Realizado (declarado)'}</span>
    <h3>{m.title}</h3>
    <p><strong>Protocolo:</strong> {m.protocol_number}</p>
    <p><strong>Previsão:</strong> {date(m.planned_on)} · {formatBRLCents(m.planned_amount_cents)}</p>
    <p><strong>Premissas:</strong> {m.plan_note}</p>
    {m.status==='realizado'&&m.realized_on&&m.realized_amount_cents!==null&&
     <div>
      <p><strong>Realização declarada:</strong> {date(m.realized_on)} ·
       {' '}{formatBRLCents(m.realized_amount_cents)}</p>
      <p><strong>Diferença em relação à previsão:</strong>
       {' '}{formatBRLCents(moneyDifferenceCents(m.planned_amount_cents,
        m.realized_amount_cents).replace(/^-/,''))}
       {BigInt(m.realized_amount_cents)<BigInt(m.planned_amount_cents)?' abaixo':' acima ou igual'}
      </p>
      <p><strong>Evidência:</strong> {m.realization_note}</p>
      <p><strong>Comprovante:</strong> {downloads&&m.proof_item_id&&m.proof_version?
       <a href={'/api/projects/'+id+'/documents/'+m.proof_item_id+
        '/versions/'+m.proof_version}>Baixar versão {m.proof_version}</a>:
       'Download desabilitado'} · SHA-256: <code>{m.proof_sha256}</code></p>
      <p className="help">Informado por {m.realizer_name}{m.realized_at?' · '+stamp(m.realized_at):''}</p>
     </div>}
    <p className="help">Criado por {m.creator_name} · {stamp(m.created_at)} ·
     {' '}revisão {m.revision}</p>
    {events.filter(e=>e.milestone_id===m.id).map(e=><p className="help" key={e.id}>
     {e.action==='planned'?'Previsão':'Realização'} · {date(e.effective_on)} ·
     {' '}{formatBRLCents(e.amount_cents)} · {e.actor_name} · {stamp(e.recorded_at)}
     {' '}· revisão {e.revision}</p>)}
    {canWrite&&m.status==='previsto'&&proofs.length>0&&
     <FinancialMilestoneRealize milestoneId={m.id} proofs={proofs} today={today}/>}
    {canWrite&&m.status==='previsto'&&!proofs.length&&
     <p className="note">Anexe primeiro um comprovante versionado ao checklist do projeto.</p>}
   </article>)}</div>
   {milestones.length===200&&<p className="note">Lista limitada aos 200 registros mais antigos
    por data prevista. Consulte o banco auditado para extratos completos.</p>}
   {events.length===400&&<p className="note">Exibidos no máximo 400 eventos.</p>}
  </section>
 </>;
}
