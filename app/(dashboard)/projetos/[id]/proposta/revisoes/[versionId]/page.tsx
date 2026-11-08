import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {READ_PROPOSAL_REVIEW_HISTORY_SQL} from '@/lib/proposal-review-sql.mjs';
import {PROPOSAL_REVIEW_LABELS} from '@/lib/proposal-review.mjs';
export const dynamic='force-dynamic';

type Version={id:string;version:number;created_at:string;
 author_name:string;origin:string;source_snapshot:unknown;missing_fields:string[]};
type Event={id:string;revision:number;decision:'aprovada'|'devolvida';
 review_note:string;acknowledged_missing_sources:boolean;
 reviewed_at:string;reviewer_name:string;version:number;version_author:string};

export default async function ProposalReviewHistory({params}:{
 params:Promise<{id:string;versionId:string}>
}){
 const user=await requireSession(),{id,versionId}=await params;
 if(!z.string().uuid().safeParse(id).success||
  !z.string().uuid().safeParse(versionId).success)notFound();
 const [version]=await queryForMunicipality<Version>(user.municipality_id,
  `SELECT v.id,v.version,v.created_at,v.origin,v.source_snapshot,
   v.missing_fields,u.full_name AS author_name FROM project_proposal_versions v
   JOIN users u ON u.id=v.created_by AND u.municipality_id=v.municipality_id
   WHERE v.municipality_id=$1::uuid AND v.project_id=$2::uuid
   AND v.id=$3::uuid`,[user.municipality_id,id,versionId],user.id);
 if(!version)notFound();
 const events=await queryForMunicipality<Event>(user.municipality_id,
  READ_PROPOSAL_REVIEW_HISTORY_SQL,[user.municipality_id,id,versionId],user.id);
 const format=(v:string)=>new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
 return <>
  <div className="section-eyebrow">TRILHA DE REVISÃO · AF-033</div>
  <div className="page-heading"><div>
   <h1>Avaliação da versão {version.version}</h1>
   <p>Conteúdo imutável · autor {version.author_name} · {format(version.created_at)}</p>
  </div><Link className="btn btn-outline" href={'/projetos/'+id+'/proposta'}>
   Voltar à proposta</Link></div>
  <section className="panel">
   <h2>Proveniência e limites</h2>
   <p>Origem registrada: {version.origin==='manual_revision'?
    'Revisão manual de minuta anterior':'Modelo gerado com dados municipais'}.</p>
   <p>Pendências no retrato original: {version.missing_fields.length?
    version.missing_fields.join(', '):'Nenhuma detectada pelo modelo'}.</p>
   <p className="help">O retrato das fontes desta versão é armazenado
    imutavelmente. A revisão é editorial e interna, sem homologação
    jurídica, aferição de elegibilidade ou protocolo externo.</p>
  </section>
  <section className="panel">
   <h2>Decisões imutáveis ({events.length} exibidas)</h2>
   {!events.length&&<p>Esta versão ainda não recebeu uma decisão humana.</p>}
   {events.map(e=><article key={e.id} className="review-event"
    data-review-revision={e.revision}>
    <span className="chip">Revisão {e.revision} ·
     {' '}{PROPOSAL_REVIEW_LABELS[e.decision]}</span>
    <p>{e.review_note}</p>
    <p className="help">Revisor: {e.reviewer_name} · {format(e.reviewed_at)}</p>
    <p className="help">Ciência das fontes e pendências:
     {' '}{e.acknowledged_missing_sources?'registrada':'não registrada'}</p>
   </article>)}
  </section>
 </>;
}
