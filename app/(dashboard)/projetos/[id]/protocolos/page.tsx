import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {todaySaoPaulo} from '@/lib/document-validity.mjs';
import {ExternalProtocolForm} from '@/components/external-protocol-form';
export const dynamic='force-dynamic';
type Project={id:string;title:string;owner_user_id:string|null;is_example:boolean|null;opportunity_title:string|null};
type Review={state:string;revision:number};
type Proof={id:string;item_id:string;file_name:string;version:number;item_title:string;sha256:string};
type Protocol={id:string;portal_name:string;portal_url:string;portal_host:string;
 protocol_number:string;submitted_on:string;proof_version_id:string;proof_item_id:string;
 proof_version:number;proof_sha256:string;file_name:string;recorded_at:string;
 recorded_by_name:string;review_revision:number;note:string};
export default async function ProjectProtocols({params}:{params:Promise<{id:string}>}){
 const user=await requireSession();
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(user.municipality_id,
  'SELECT p.id,p.title,p.owner_user_id,o.is_example,o.title AS opportunity_title '+
  'FROM projects p LEFT JOIN opportunities o ON o.id=p.opportunity_id '+
  'WHERE p.id=$1 AND p.municipality_id=$2',
  [id,user.municipality_id],user.id);
 if(!project)notFound();
 const [reviews,proofs,protocols]=await Promise.all([
  queryForMunicipality<Review>(user.municipality_id,
   'SELECT state,revision FROM project_internal_reviews WHERE project_id=$1 AND municipality_id=$2',
   [id,user.municipality_id],user.id),
  queryForMunicipality<Proof>(user.municipality_id,
   'SELECT v.id,v.item_id,v.file_name,v.version,v.sha256,d.title AS item_title '+
   'FROM project_document_versions v JOIN project_document_items d '+
   'ON d.id=v.item_id AND d.municipality_id=v.municipality_id AND d.project_id=v.project_id '+
   'WHERE v.project_id=$1 AND v.municipality_id=$2 ORDER BY d.title,v.version DESC LIMIT 200',
   [id,user.municipality_id],user.id),
  queryForMunicipality<Protocol>(user.municipality_id,
   "SELECT p.id,p.portal_name,p.portal_url,p.portal_host,p.protocol_number,"+
   "to_char(p.submitted_on,'YYYY-MM-DD') AS submitted_on,p.proof_version_id,"+
   "p.proof_item_id,p.proof_version,p.proof_sha256,v.file_name,p.recorded_at,"+
   "u.full_name AS recorded_by_name,p.review_revision,p.note "+
   "FROM project_external_protocols p JOIN project_document_versions v "+
   "ON v.id=p.proof_version_id AND v.municipality_id=p.municipality_id "+
   "JOIN users u ON u.id=p.recorded_by AND u.municipality_id=p.municipality_id "+
   "WHERE p.project_id=$1 AND p.municipality_id=$2 ORDER BY p.recorded_at DESC,p.id LIMIT 100",
   [id,user.municipality_id],user.id),
 ]);
 const review=reviews[0]??null;
 const permitted=user.role==='admin'||project.owner_user_id===user.id;
 const enabled=process.env.ENABLE_EXTERNAL_PROTOCOL_RECORDS==='yes';
 const canRecord=enabled&&permitted&&review?.state==='autorizada'&&
  !project.is_example&&proofs.length>0;
 const downloads=process.env.ENABLE_DOCUMENT_UPLOADS==='yes';
 return <>
  <div className="section-eyebrow">COMPROVAÇÃO DA CANDIDATURA</div>
  <div className="page-heading">
   <div><h1>Protocolos externos informados</h1>
    <p>{project.title} · {project.opportunity_title??'Sem oportunidade vinculada'}</p>
   </div>
   <div className="radar-actions">
    <Link href={'/projetos/'+id+'/revisao'} className="btn btn-outline">Revisão interna</Link>
    <Link href={'/projetos/'+id+'/documentos'} className="btn btn-outline">Documentos</Link>
    <Link href={'/projetos/'+id} className="btn btn-outline">Voltar ao projeto</Link>
   </div>
  </div>
  {project.is_example&&<p className="demo-notice">
   Oportunidade <strong>FICTÍCIA / TESTE</strong>: o registro de protocolo está bloqueado.</p>}
  <section className="panel">
   <h2>Condição para registrar</h2>
   <p className="help">Somente registros da equipe municipal, após autorização interna.
    O comprovante deve existir como uma versão privada anexada a este projeto.
    O protocolo e sua autenticidade devem ser conferidos manualmente no órgão de origem.</p>
   <p className="help"><strong>Revisão interna:</strong> {review?
    (review.state==='autorizada'?'Autorizada · revisão '+review.revision:
    'Ainda não autorizada · revisão '+review.revision):
    'Não iniciada'}.</p>
   {!enabled&&<p className="note">O cadastro de protocolos está desabilitado por
    padrão até homologação documental, segurança e privacidade.</p>}
   {enabled&&review?.state!=='autorizada'&&<p className="note">
    Somente candidaturas autorizadas internamente podem receber um protocolo.</p>}
   {enabled&&proofs.length===0&&<p className="note">Nenhum comprovante versionado disponível.
    Anexe primeiro o arquivo correto no checklist documental do projeto.</p>}
   {canRecord?<ExternalProtocolForm key={id+'-'+review?.revision}
    projectId={id} reviewRevision={review?.revision??0} proofs={proofs}
    today={todaySaoPaulo()}/>:
    <p className="muted">O cadastro não está disponível nas condições atuais.</p>}
   {proofs.length===200&&<p className="note">Exibidas até 200 versões disponíveis para seleção.
    Consulte o checklist para localizar outras versões.</p>}
  </section>
  <section className="panel">
   <h2>Histórico de protocolos declarados ({protocols.length})</h2>
   {protocols.length?<div className="review-events">
    {protocols.map(p=><article className="review-event" key={p.id}>
     <span className="chip">Informado · conferência externa pendente</span>
     <h3>{p.protocol_number} — {p.portal_name}</h3>
     <p><strong>Portal indicado:</strong> <a target="_blank" rel="noopener noreferrer"
      href={p.portal_url}>{p.portal_host}</a> (URL declarada, não verificada)</p>
     <p><strong>Data informada de submissão:</strong> {p.submitted_on.split('-').reverse().join('/')}</p>
     <p><strong>Responsável:</strong> {p.recorded_by_name} ·
      {' '}{new Date(p.recorded_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
     <p><strong>Autorização interna vinculada:</strong> revisão {p.review_revision}</p>
     <p><strong>Comprovante:</strong> {downloads?
      <a href={'/api/projects/'+id+'/documents/'+p.proof_item_id+
       '/versions/'+p.proof_version}>Baixar {p.file_name} · v{p.proof_version}</a>:
      <span>{p.file_name} · v{p.proof_version} (download desabilitado)</span>}</p>
     <p className="protocol-hash"><strong>SHA-256:</strong> <code>{p.proof_sha256}</code></p>
     <p><strong>Observação:</strong> {p.note}</p>
    </article>)}
   </div>:<p className="muted">Nenhum protocolo externo informado para este projeto.</p>}
   {protocols.length===100&&<p className="note">Histórico limitado aos primeiros 100
    protocolos mais recentes do projeto.</p>}
  </section>
 </>;
}
