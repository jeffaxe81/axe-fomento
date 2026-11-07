import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
export const dynamic='force-dynamic';
type Suggestion={
 id:string;batch_id:string;seq:number;source_page:number|null;
 source_excerpt:string|null;suggested_requirement:string;evidence_state:string;
 input_sha256:string;document_version_id:string;file_name:string;
 document_version:number;document_sha256:string;
};
type Event={id:string;revision:number;decision:string;review_note:string;
 reviewed_at:string;reviewer_name:string};
export default async function SuggestionHistory({params}:{
 params:Promise<{id:string;suggestionId:string}>
}){
 const user=await requireSession(),{id,suggestionId}=await params;
 if(!z.string().uuid().safeParse(id).success||
  !z.string().uuid().safeParse(suggestionId).success)notFound();
 const [suggestion]=await queryForMunicipality<Suggestion>(user.municipality_id,
  `SELECT s.id,s.batch_id,s.seq,s.source_page,s.source_excerpt,
    s.suggested_requirement,s.evidence_state,b.input_sha256,
    b.document_version_id,v.file_name,v.version AS document_version,
    v.sha256 AS document_sha256
    FROM project_edict_suggestions s
    JOIN project_edict_extraction_batches b ON b.id=s.batch_id
      AND b.municipality_id=s.municipality_id AND b.project_id=s.project_id
    JOIN project_document_versions v ON v.id=b.document_version_id
      AND v.municipality_id=b.municipality_id AND v.project_id=b.project_id
    WHERE s.municipality_id=$1 AND s.project_id=$2 AND s.id=$3`,
  [user.municipality_id,id,suggestionId],user.id);
 if(!suggestion)notFound();
 const events=await queryForMunicipality<Event>(user.municipality_id,
  `SELECT e.id,e.revision,e.decision,e.review_note,e.reviewed_at,
    u.full_name AS reviewer_name FROM project_edict_suggestion_reviews e
    JOIN users u ON u.id=e.reviewed_by AND u.municipality_id=e.municipality_id
    WHERE e.municipality_id=$1 AND e.project_id=$2 AND e.suggestion_id=$3
    ORDER BY e.revision DESC LIMIT 1000`,
  [user.municipality_id,id,suggestionId],user.id);
 return <>
  <div className="section-eyebrow">REVISÃO HUMANA · AF-030</div>
  <div className="page-heading"><div><h1>Histórico da sugestão {suggestion.seq}</h1>
   <p>{suggestion.suggested_requirement}</p></div>
   <Link className="btn btn-outline"
    href={'/projetos/'+id+'/extracao-edital?lote='+suggestion.batch_id}>Voltar ao lote</Link></div>
  <section className="panel">
   <h2>Proveniência declarada</h2>
   <p><strong>Documento:</strong> {suggestion.file_name} · v{suggestion.document_version}</p>
   <p><strong>Página:</strong> {suggestion.source_page??'não informada'}</p>
   <p><strong>Trecho:</strong> {suggestion.source_excerpt??'Sem evidência capturada'}</p>
   <p className="help"><strong>SHA-256 do anexo:</strong>
    {' '}<code>{suggestion.document_sha256}</code></p>
   <p className="help"><strong>SHA-256 do texto fornecido:</strong>
    {' '}<code>{suggestion.input_sha256}</code></p>
   <p>A versão do anexo foi associada manualmente. Nenhuma validação
    automática de correspondência ou autenticidade foi efetuada.</p>
  </section>
  <section className="panel">
   <h2>Eventos imutáveis ({events.length} exibidos)</h2>
   {!events.length&&<p className="muted">Nenhuma avaliação efetuada; sugestão pendente.</p>}
   {events.map(e=><article key={e.id} className="review-event" data-revision={e.revision}>
    <span className="chip">Revisão {e.revision} · {e.decision}</span>
    <p>{e.review_note}</p>
    <p className="help">{e.reviewer_name} ·
     {' '}{new Date(e.reviewed_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
   </article>)}
  </section>
 </>;
}
