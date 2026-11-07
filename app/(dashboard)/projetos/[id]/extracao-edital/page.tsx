import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {READ_EDICT_BATCHES_SQL,READ_EDICT_SUGGESTIONS_SQL} from '@/lib/edict-extraction-sql.mjs';
import {EdictExtractionForm,EdictSuggestionReview} from '@/components/edict-extraction-forms';
export const dynamic='force-dynamic';

type Project={id:string;title:string;owner_user_id:string|null;is_example:boolean|null};
type SourceDoc={id:string;item_id:string;file_name:string;version:number;sha256:string};
type Batch={id:string;document_version_id:string;input_sha256:string;
 input_length:number;suggestion_count:number;note:string;created_at:string;
 document_version:number;file_name:string;document_sha256:string;author_name:string};
type Suggestion={id:string;batch_id:string;seq:number;source_page:number|null;
 source_excerpt:string|null;suggested_requirement:string;evidence_state:'excerpt'|'missing';
 revision:number|null;decision:string|null;review_note:string|null;
 reviewed_at:string|null;reviewer_name:string|null};
export default async function EdictExtractionPage({params,searchParams}:{
 params:Promise<{id:string}>;
 searchParams:Promise<{lote?:string}>;
}){
 const user=await requireSession();
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(user.municipality_id,
  `SELECT p.id,p.title,p.owner_user_id,o.is_example FROM projects p
   LEFT JOIN opportunities o ON o.id=p.opportunity_id
   WHERE p.municipality_id=$1 AND p.id=$2`,[user.municipality_id,id],user.id);
 if(!project)notFound();
 const [documents,batches]=await Promise.all([
  queryForMunicipality<SourceDoc>(user.municipality_id,
   `SELECT id,item_id,file_name,version,sha256 FROM project_document_versions
    WHERE municipality_id=$1 AND project_id=$2 AND media_type='application/pdf'
    ORDER BY uploaded_at DESC,id DESC LIMIT 100`,
    [user.municipality_id,id],user.id),
  queryForMunicipality<Batch>(user.municipality_id,READ_EDICT_BATCHES_SQL,
   [user.municipality_id,id],user.id)
 ]);
 const requested=(await searchParams).lote;
 const batch=requested?batches.find(b=>b.id===requested):batches[0];
 if(requested&&!batch)notFound();
 const suggestions=batch?await queryForMunicipality<Suggestion>(user.municipality_id,
  READ_EDICT_SUGGESTIONS_SQL,
  [user.municipality_id,id,batch.id],user.id):[];
 const canReview=process.env.ENABLE_EDICT_ASSISTED_EXTRACTION==='yes'&&
  !project.is_example&&(user.role==='admin'||project.owner_user_id===user.id);
 const missing=suggestions.filter(s=>s.evidence_state==='missing').length;
 const pending=suggestions.filter(s=>!s.decision||s.decision==='pendente').length;
 return <>
  <div className="section-eyebrow">AXE AI · EXTRAÇÃO ASSISTIDA · AF-030</div>
  <div className="page-heading"><div>
   <h1>Sugestões de requisitos de edital</h1><p>{project.title}</p>
   </div><div className="radar-actions">
   <Link className="btn btn-outline" href={'/projetos/'+id+'/documentos'}>Anexos do projeto</Link>
   <Link className="btn btn-outline" href={'/projetos/'+id+'/requisitos'}>Matriz de requisitos</Link>
   <Link className="btn btn-outline" href={'/projetos/'+id}>Voltar ao projeto</Link>
  </div></div>
  <section className="panel">
   <h2>Escopo e limites</h2>
   <p>O sistema destaca frases de possível obrigação no texto fornecido pela
    equipe. <strong>Não faz OCR, não lê automaticamente o PDF e não utiliza
    modelo generativo nesta etapa.</strong> A correspondência com o anexo
    é declarada pelo operador e precisa ser conferida na publicação original.</p>
   <p>O texto completo colado não é armazenado; ficam o resumo SHA-256 do texto
    fornecido, os trechos sugeridos e a versão criptografada do documento de origem.
    Uma aprovação aqui é somente <strong>revisão interna de sugestão</strong>,
    sem criar automaticamente requisito obrigatório ou conclusão jurídica.</p>
   {project.is_example&&<p className="demo-notice">Oportunidade fictícia:
    registros e revisões desabilitados.</p>}
  </section>
  <section className="panel">
   <h2>Gerar sugestões a partir de texto informado</h2>
   {canReview&&documents.length?<EdictExtractionForm projectId={id} documents={documents}/>:
    <p className="muted">É necessário um PDF versionado no checklist documental,
     titularidade ou perfil administrador, além da liberação de homologação
     da funcionalidade. A consulta dos lotes anteriores permanece disponível.</p>}
   {documents.length===100&&<p className="note">Seleção limitada às 100
    versões de PDFs mais recentes deste projeto.</p>}
  </section>
  <section className="panel">
   <h2>Lotes registrados ({batches.length} exibidos)</h2>
   {batches.length===0?<p className="muted">Nenhuma extração registrada.</p>:
    <div className="review-events">{batches.map(b=><article key={b.id} className="review-event">
     <p><Link href={'/projetos/'+id+'/extracao-edital?lote='+b.id}>
      {b.file_name} · versão {b.document_version} · {b.suggestion_count} sugestões</Link></p>
     <p className="help">{b.note} · registrado por {b.author_name}</p>
     <p className="help">SHA-256 do texto fornecido: <code>{b.input_sha256}</code></p>
    </article>)}</div>}
   {batches.length===50&&<p className="note">Exibição limitada aos 50
    lotes mais recentes; histórico anterior permanece armazenado.</p>}
  </section>
  {batch&&<section className="panel" id="sugestoes">
   <h2>Sugestões do lote selecionado</h2>
   <p className="help">{suggestions.length} sugestões · {pending} pendentes ·
    {' '}{missing} sem trecho suficiente para aprovação.</p>
   <p className="help">Anexo declarado: {batch.file_name},
    versão {batch.document_version}. SHA-256 do anexo:
    {' '}<code>{batch.document_sha256}</code></p>
   {suggestions.map(s=><article key={s.id} className="review-event" data-suggestion={s.seq}>
    <span className="chip">Sugestão {s.seq} ·
     {' '}{s.decision==='aprovada'?'Aprovada internamente':
     s.decision==='rejeitada'?'Rejeitada':'Pendente de revisão'}</span>
    <h3>{s.suggested_requirement}</h3>
    <p><strong>Página declarada:</strong> {s.source_page??'não informada'}</p>
    <p><strong>Evidência textual:</strong>
     {' '}{s.source_excerpt??'Ausente: aprovação bloqueada até nova análise com evidência'}</p>
    {s.review_note&&<p><strong>Última justificativa:</strong> {s.review_note}</p>}
    <p><Link href={'/projetos/'+id+'/extracao-edital/'+s.id}>
     Histórico de revisão desta sugestão</Link></p>
    {canReview&&<EdictSuggestionReview
     key={s.id+'-'+(s.revision??0)}
     projectId={id} suggestionId={s.id} currentRevision={s.revision??0}
     decision={s.decision} evidencePresent={s.evidence_state==='excerpt'&&!!s.source_excerpt}/>}
   </article>)}
  </section>}
 </>;
}
