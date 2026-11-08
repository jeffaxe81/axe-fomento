import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {reviewLabel,modalityLabel} from '@/lib/modality-map.mjs';
export const dynamic='force-dynamic';
type Check={id:string;project_id:string;criterion:string;modality:string;
 normative_version_id:string;normative_version:number;reference_code:string;source_id:string;
 source_url:string;source_section:string;excerpt:string;snapshot_sha256:string};
type Event={id:string;revision:number;status:string;justification:string;
 recorded_at:string;full_name:string};
export default async function ModalityHistory({params}:{
 params:Promise<{id:string;checkId:string}>
}){
 const actor=await requireSession(),{id,checkId}=await params;
 if(!z.string().uuid().safeParse(id).success||
    !z.string().uuid().safeParse(checkId).success)notFound();
 const [check]=await queryForMunicipality<Check>(actor.municipality_id,
  `SELECT c.id,c.project_id,c.criterion,c.modality,c.normative_version_id,
    c.normative_version,s.reference_code,v.source_id,v.source_url,
    v.source_section,v.excerpt,v.snapshot_sha256
   FROM project_modality_checks c
   JOIN municipal_normative_versions v ON v.id=c.normative_version_id
    AND v.source_id=c.normative_source_id AND v.version=c.normative_version
    AND v.municipality_id=c.municipality_id
   JOIN municipal_normative_sources s ON s.id=v.source_id
    AND s.municipality_id=v.municipality_id
   WHERE c.id=$1 AND c.project_id=$2 AND c.municipality_id=$3`,
  [checkId,id,actor.municipality_id],actor.id);
 if(!check)notFound();
 const history=await queryForMunicipality<Event>(actor.municipality_id,
  `SELECT e.id,e.revision,e.status,e.justification,e.recorded_at,u.full_name
   FROM project_modality_review_events e
   JOIN users u ON u.id=e.actor_id AND u.municipality_id=e.municipality_id
   WHERE e.municipality_id=$1 AND e.project_id=$2 AND e.check_id=$3
   ORDER BY e.revision DESC LIMIT 100`,[actor.municipality_id,id,checkId],actor.id);
 return <>
  <div className="section-eyebrow">HISTÓRICO DE ENQUADRAMENTO · AF-029</div>
  <div className="page-heading"><div><h1>Revisões do critério</h1>
   <p>{modalityLabel(check.modality)} · {check.criterion}</p></div>
   <Link className="btn btn-outline" href={'/projetos/'+id+'/enquadramento'}>
    Voltar ao mapa</Link></div>
  <section className="panel">
   <h2>Fonte histórica imutável</h2>
   <p><Link href={'/normativos/'+check.source_id}>
    {check.reference_code}, versão {check.normative_version}</Link></p>
   <p>Seção: {check.source_section}</p>
   <p>Trecho documentado: {check.excerpt}</p>
   <p className="help">Versão registrada: <code>{check.normative_version_id}</code></p>
   <p className="help">SHA-256 da declaração: <code>{check.snapshot_sha256}</code></p>
   <p><a href={check.source_url} target="_blank" rel="noopener noreferrer">
    Fonte declarada, não autenticada</a></p>
  </section>
  <section className="panel">
   <h2>Histórico de avaliação ({history.length} exibidas)</h2>
   {history.map(e=><article key={e.id} className="review-event" data-revision={e.revision}>
    <span className="chip">Revisão {e.revision} · {reviewLabel(e.status)}</span>
    <p>{e.justification}</p>
    <p className="help">{e.full_name} · {new Date(e.recorded_at).toLocaleString(
     'pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
   </article>)}
   {history.length===100&&<p className="note">Exibição limitada às 100
    revisões mais recentes. Demais eventos permanecem armazenados.</p>}
  </section>
 </>;
}
