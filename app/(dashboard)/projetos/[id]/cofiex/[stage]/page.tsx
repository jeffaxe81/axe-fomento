import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {COFIEX_STATES} from '@/lib/cofiex-labels.mjs';
import {COFIEX_STAGE_HISTORY_SQL} from '@/lib/cofiex-sql.mjs';
export const dynamic='force-dynamic';
type Stage={code:string;title:string;source_url:string;description:string};
type Event={id:string;stage_code:string;revision:number;
 consultation_state:string;consulted_on:string;note:string;
 source_url_snapshot:string;reference_code:string;
 snapshot_sha256:string;recorded_at:string;author_name:string};
export default async function CofiexStageHistory({params}:{
 params:Promise<{id:string;stage:string}>
}){
 const actor=await requireSession(),{id,stage}=await params;
 if(!z.string().uuid().safeParse(id).success||
  !/^[a-z0-9_]{5,50}$/.test(stage))notFound();
 const [project]=await queryForMunicipality<{id:string;title:string}>(
  actor.municipality_id,
  'SELECT id,title FROM projects WHERE municipality_id=$1::uuid AND id=$2::uuid',
  [actor.municipality_id,id],actor.id);
 if(!project)notFound();
 const [reference]=await queryForMunicipality<Stage>(actor.municipality_id,
  `SELECT s.code,s.title,s.description,r.source_url
   FROM cofiex_consultation_stages s
   JOIN cofiex_official_references r ON r.code=s.reference_code
   WHERE s.code=$1::text`,[stage],actor.id);
 if(!reference)notFound();
 const events=await queryForMunicipality<Event>(actor.municipality_id,
  COFIEX_STAGE_HISTORY_SQL,[actor.municipality_id,id,stage],actor.id);
 const clock=(v:string)=>new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 return <>
  <div className="section-eyebrow">TRILHA DE CONSULTA · AF-036</div>
  <div className="page-heading"><div><h1>{reference.title}</h1>
   <p>{project.title}</p></div>
   <Link href={'/projetos/'+id+'/cofiex'} className="btn btn-outline">
    Voltar às etapas</Link></div>
  <section className="panel">
   <h2>Fonte e limites</h2><p>{reference.description}</p>
   <p><a href={reference.source_url} target="_blank"
    rel="noopener noreferrer">Consultar fonte oficial atual</a></p>
   <p>Os registros são declarações internas e não comprovam
    atendimento a normas, envio no PFE, aprovação na COFIEX
    ou acesso garantido a financiamento.</p>
  </section>
  <section className="panel">
   <h2>Histórico de conferências ({events.length} registros exibidos)</h2>
   {!events.length&&<p>Nenhuma consulta interna registrada para esta etapa.</p>}
   {events.map(e=><article className="review-event" key={e.id}
    data-cofiex-revision={e.revision}>
    <span className="chip">Revisão {e.revision} ·
     {' '}{COFIEX_STATES[e.consultation_state]}</span>
    <p><strong>Consultado em:</strong>
     {' '}{e.consulted_on.split('-').reverse().join('/')}</p>
    <p><strong>Observação:</strong> {e.note}</p>
    <p><a href={e.source_url_snapshot} target="_blank"
     rel="noopener noreferrer">Fonte congelada no registro</a></p>
    <p className="help">Responsável: {e.author_name} · {clock(e.recorded_at)} ·
     SHA-256 dos metadados: {e.snapshot_sha256}</p>
   </article>)}
   {events.length===100&&<p className="note">Exibição limitada
    às 100 versões recentes; anteriores permanecem preservadas.</p>}
  </section>
 </>;
}
