import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {todaySaoPaulo} from '@/lib/document-validity.mjs';
import {COFIEX_STATES} from '@/lib/cofiex-labels.mjs';
import {cofiexStatusAge} from '@/lib/cofiex-check.mjs';
import {COFIEX_PROJECT_STAGES_SQL} from '@/lib/cofiex-sql.mjs';
import {CofiexCheckForm} from '@/components/cofiex-check-form';
export const dynamic='force-dynamic';
type Project={id:string;title:string;owner_user_id:string|null;is_example:boolean|null};
type Stage={code:string;stage_number:number;title:string;description:string;
 reference_title:string;source_url:string;category:string;
 revision:number|null;consultation_state:string|null;consulted_on:string|null;
 note:string|null;recorded_at:string|null};
export default async function CofiexProject({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(actor.municipality_id,
  `SELECT p.id,p.title,p.owner_user_id,o.is_example FROM projects p
   LEFT JOIN opportunities o ON o.id=p.opportunity_id
   WHERE p.municipality_id=$1::uuid AND p.id=$2::uuid`,
  [actor.municipality_id,id],actor.id);
 if(!project)notFound();
 const stages=await queryForMunicipality<Stage>(actor.municipality_id,
  COFIEX_PROJECT_STAGES_SQL,[actor.municipality_id,id],actor.id);
 const enabled=process.env.ENABLE_COFIEX_CATALOG==='yes';
 const canWrite=enabled&&!project.is_example&&
  (actor.role==='admin'||project.owner_user_id===actor.id);
 const checked=stages.filter(x=>x.revision!==null).length;
 const today=todaySaoPaulo();
 return <>
  <div className="section-eyebrow">FLUXO EXTERNO · AF-036</div>
  <div className="page-heading"><div><h1>Consulta COFIEX do projeto</h1>
   <p>{project.title}</p>
  </div><div className="radar-actions">
   <Link className="btn btn-outline" href="/cofiex">Fontes COFIEX</Link>
   <Link className="btn btn-outline" href={'/projetos/'+id}>Voltar ao projeto</Link>
  </div></div>
  <section className="panel">
   <h2>Roteiro interno: {checked} de {stages.length} etapas com registro</h2>
   <p>As etapas abaixo constituem um checklist de preparação e acompanhamento,
    não representam marcos formalmente atingidos perante a COFIEX, STN,
    SEAID ou o financiador. Cada atualização é uma declaração da equipe.
    O AXE não protocola pleitos nem consulta automaticamente o PFE.</p>
   {project.is_example&&<p className="demo-notice">Oportunidade fictícia:
    registro de conferência desabilitado.</p>}
  </section>
  <section className="panel">
   <h2>Etapas, referência documental e observações</h2>
   <div className="review-events">
   {stages.map(s=><article key={s.code} className="review-event" data-cofiex-stage={s.code}>
    <span className="chip">Etapa {s.stage_number} ·
     {' '}{s.consultation_state?COFIEX_STATES[s.consultation_state]:
      'Sem consulta registrada'}</span>
    <h3>{s.title}</h3>
    <p>{s.description}</p>
    <p><strong>Referência:</strong> {s.reference_title} ·
     {' '}<a href={s.source_url} target="_blank"
      rel="noopener noreferrer">Abrir fonte oficial</a></p>
    {s.revision!==null&&<p className="help">Última revisão interna:
     {' '}{s.revision} · {cofiexStatusAge(s.consulted_on,today)}</p>}
    {s.note&&<p><strong>Nota registrada:</strong> {s.note}</p>}
    <p><Link href={'/projetos/'+id+'/cofiex/'+s.code}>
     Ver trilha auditável desta etapa</Link></p>
    {canWrite&&s.revision!==1000&&<details>
     <summary>Adicionar conferência interna</summary>
     <CofiexCheckForm key={s.code+'-'+(s.revision??0)}
      projectId={id} stageCode={s.code}
      expectedRevision={s.revision??0} today={today}/>
    </details>}
   </article>)}
   </div>
   {!canWrite&&<p className="muted">Inclusão de registros reservada ao
    administrador ou responsável pelo projeto, condicionada à homologação.</p>}
  </section>
 </>;
}
