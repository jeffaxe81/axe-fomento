import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {todaySaoPaulo,expiryStatus} from '@/lib/document-validity.mjs';
import {ProtocolDiligenceCreate,ProtocolDiligenceReply} from '@/components/protocol-diligences';
export const dynamic='force-dynamic';
type Project={id:string;title:string;owner_user_id:string|null};
type Protocol={id:string;protocol_number:string;portal_name:string};
type User={id:string;full_name:string};
type Proof={id:string;item_id:string;file_name:string;version:number;item_title:string;sha256:string};
type Diligence={id:string;protocol_number:string;portal_name:string;title:string;details:string;
 due_on:string;state:'pendente'|'respondida';assigned_to:string;assigned_name:string;
 revision:number;response_text:string|null;proof_item_id:string|null;proof_version:number|null;
 proof_sha256:string|null;responded_by_name:string|null;created_by_name:string;
 created_at:string;responded_at:string|null};
type Event={id:string;diligence_id:string;action:string;revision:number;note:string;
 actor_name:string;recorded_at:string};
export default async function ProjectDiligences({params}:{params:Promise<{id:string}>}){
 const user=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(user.municipality_id,
  'SELECT id,title,owner_user_id FROM projects WHERE id=$1 AND municipality_id=$2',
  [id,user.municipality_id],user.id);
 if(!project)notFound();
 const [protocols,users,proofs,diligences,events]=await Promise.all([
  queryForMunicipality<Protocol>(user.municipality_id,
   'SELECT id,protocol_number,portal_name FROM project_external_protocols '+
   'WHERE project_id=$1 AND municipality_id=$2 ORDER BY recorded_at DESC LIMIT 100',
   [id,user.municipality_id],user.id),
  queryForMunicipality<User>(user.municipality_id,
   'SELECT id,full_name FROM users WHERE municipality_id=$1 AND active=true '+
   'ORDER BY lower(full_name),id LIMIT 200',[user.municipality_id],user.id),
  queryForMunicipality<Proof>(user.municipality_id,
   'SELECT v.id,v.item_id,v.file_name,v.version,v.sha256,d.title AS item_title '+
   'FROM project_document_versions v JOIN project_document_items d '+
   'ON d.id=v.item_id AND d.municipality_id=v.municipality_id AND d.project_id=v.project_id '+
   'WHERE v.project_id=$1 AND v.municipality_id=$2 ORDER BY d.title,v.version DESC LIMIT 200',
   [id,user.municipality_id],user.id),
  queryForMunicipality<Diligence>(user.municipality_id,
   "SELECT d.id,p.protocol_number,p.portal_name,d.title,d.details,"+
   "to_char(d.due_on,'YYYY-MM-DD') AS due_on,d.state,d.assigned_to,"+
   "assignee.full_name AS assigned_name,d.revision,d.response_text,d.proof_item_id,"+
   "d.proof_version,d.proof_sha256,responder.full_name AS responded_by_name,"+
   "creator.full_name AS created_by_name,d.created_at,d.responded_at "+
   "FROM project_protocol_diligences d "+
   "JOIN project_external_protocols p ON p.id=d.protocol_id AND p.municipality_id=d.municipality_id "+
   "JOIN users assignee ON assignee.id=d.assigned_to AND assignee.municipality_id=d.municipality_id "+
   "JOIN users creator ON creator.id=d.created_by AND creator.municipality_id=d.municipality_id "+
   "LEFT JOIN users responder ON responder.id=d.responded_by AND responder.municipality_id=d.municipality_id "+
   "WHERE d.project_id=$1 AND d.municipality_id=$2 ORDER BY "+
   "CASE WHEN d.state='pendente' THEN 0 ELSE 1 END,d.due_on,d.id LIMIT 100",
   [id,user.municipality_id],user.id),
  queryForMunicipality<Event>(user.municipality_id,
   'SELECT e.id,e.diligence_id,e.action,e.revision,e.note,u.full_name AS actor_name,e.recorded_at '+
   'FROM project_protocol_diligence_events e JOIN users u '+
   'ON u.id=e.actor_id AND u.municipality_id=e.municipality_id '+
   'WHERE e.project_id=$1 AND e.municipality_id=$2 ORDER BY e.recorded_at,e.id LIMIT 300',
   [id,user.municipality_id],user.id)
 ]);
 const enabled=process.env.ENABLE_DILIGENCE_RECORDS==='yes';
 const canCreate=enabled&&(user.role==='admin'||project.owner_user_id===user.id);
 const downloads=process.env.ENABLE_DOCUMENT_UPLOADS==='yes';
 const today=todaySaoPaulo();
 const fmt=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 return <>
  <div className="section-eyebrow">ACOMPANHAMENTO DE CANDIDATURAS</div>
  <div className="page-heading">
   <div><h1>Diligências dos protocolos</h1><p>{project.title}</p></div>
   <div className="radar-actions">
    <Link className="btn btn-outline" href={'/projetos/'+id+'/protocolos'}>Protocolos</Link>
    <Link className="btn btn-outline" href={'/projetos/'+id}>Voltar ao projeto</Link>
   </div>
  </div>
  <section className="panel">
   <h2>Nova diligência declarada</h2>
   <p className="help">Vincule a solicitação ao protocolo externo, indique prazo e
    responsável ativo da prefeitura. O sistema não consulta notificações nem confirma prazos.</p>
   {!enabled&&<p className="note">Módulo desativado por padrão até homologação operacional.</p>}
   {canCreate&&protocols.length>0?<ProtocolDiligenceCreate
    projectId={id} protocols={protocols} users={users} today={today}/>:
    <p className="muted">Cadastro indisponível: é preciso ter permissão de titular ou
     administrador, habilitação operacional e protocolo previamente registrado.</p>}
  </section>
  <section className="panel">
   <h2>Acompanhamento ({diligences.length})</h2>
   {diligences.length===0&&<p className="muted">Nenhuma diligência registrada neste projeto.</p>}
   <div className="review-events">
   {diligences.map(d=>{
    const expiry=expiryStatus(d.due_on,today);
    const mayReply=enabled&&d.state==='pendente'&&proofs.length>0&&
      (user.role==='admin'||user.id===d.assigned_to);
    return <article className="review-event" key={d.id}>
     <span className="chip">{d.state==='respondida'?'Respondida':
      'Pendente · '+expiry.label}</span>
     <h3>{d.title}</h3>
     <p><strong>Protocolo:</strong> {d.protocol_number} — {d.portal_name}</p>
     <p><strong>Prazo declarado:</strong> {d.due_on.split('-').reverse().join('/')}
      {' '}· <strong>Responsável:</strong> {d.assigned_name}</p>
     <p><strong>Solicitação:</strong> {d.details}</p>
     <p className="help">Registrada por {d.created_by_name} em {fmt(d.created_at)}
      {' '}· revisão {d.revision}</p>
     {d.response_text&&<div>
      <p><strong>Resposta interna registrada:</strong> {d.response_text}</p>
      <p><strong>Respondida por:</strong> {d.responded_by_name}
       {d.responded_at?' · '+fmt(d.responded_at):''}</p>
      <p><strong>Comprovante versionado:</strong> {downloads&&d.proof_item_id&&d.proof_version?
       <a href={'/api/projects/'+id+'/documents/'+d.proof_item_id+'/versions/'+d.proof_version}>
        Baixar v{d.proof_version}</a>:
       'Download desabilitado'} · SHA-256: <code>{d.proof_sha256}</code></p>
     </div>}
     {events.filter(e=>e.diligence_id===d.id).map(e=><p className="help" key={e.id}>
      {e.action==='criada'?'Registro':'Resposta'} · {e.actor_name} · {fmt(e.recorded_at)}
      {' '}· revisão {e.revision}</p>)}
     {mayReply&&<ProtocolDiligenceReply key={d.id+'-'+d.revision}
       diligenceId={d.id} revision={d.revision} proofs={proofs}/>}
     {enabled&&d.state==='pendente'&&!mayReply&&
      <p className="note">Resposta restrita ao responsável designado ou administrador,
       com comprovante versionado disponível.</p>}
    </article>;
   })}
   </div>
   {diligences.length===100&&<p className="note">A lista exibe no máximo 100 diligências.</p>}
   {events.length===300&&<p className="note">Trilha exibida até 300 eventos neste projeto.</p>}
  </section>
 </>;
}
