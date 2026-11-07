import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {normativeVersionLabel} from '@/lib/normative-source.mjs';
import {AddNormativeVersion} from '@/components/normative-forms';
export const dynamic='force-dynamic';
type Source={id:string;reference_code:string;title:string;jurisdiction:string;
 state_uf:string|null;created_at:string;created_by_name:string};
type Version={id:string;version:number;source_url:string;published_on:string;
 valid_from:string;valid_until:string|null;source_section:string;excerpt:string;
 context_note:string;snapshot_sha256:string;recorded_at:string;author_name:string};
export default async function NormativeHistory({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [source]=await queryForMunicipality<Source>(actor.municipality_id,
  `SELECT s.id,s.reference_code,s.title,s.jurisdiction,s.state_uf,
   s.created_at,u.full_name AS created_by_name
   FROM municipal_normative_sources s
   JOIN users u ON u.id=s.created_by AND u.municipality_id=s.municipality_id
   WHERE s.id=$1 AND s.municipality_id=$2`,
  [id,actor.municipality_id],actor.id);
 if(!source)notFound();
 const versions=await queryForMunicipality<Version>(actor.municipality_id,
  `SELECT v.id,v.version,v.source_url,
   to_char(v.published_on,'YYYY-MM-DD') AS published_on,
   to_char(v.valid_from,'YYYY-MM-DD') AS valid_from,
   to_char(v.valid_until,'YYYY-MM-DD') AS valid_until,
   v.source_section,v.excerpt,v.context_note,v.snapshot_sha256,
   v.recorded_at,u.full_name AS author_name
   FROM municipal_normative_versions v
   JOIN users u ON u.id=v.created_by AND u.municipality_id=v.municipality_id
   WHERE v.municipality_id=$1 AND v.source_id=$2
   ORDER BY v.version DESC LIMIT 1000`,[actor.municipality_id,id],actor.id);
 const latestVersion=versions[0]?.version??0;
 const fmt=(d:string)=>d.split('-').reverse().join('/');
 const enabled=process.env.ENABLE_NORMATIVE_REGISTRY==='yes';
 return <>
  <div className="section-eyebrow">HISTÓRICO NORMATIVO · AF-028</div>
  <div className="page-heading">
   <div><h1>{source.reference_code}</h1><p>{source.title}</p></div>
   <Link className="btn btn-outline" href="/normativos">Voltar à base normativa</Link>
  </div>
  <section className="panel">
   <h2>Identificação da referência</h2>
   <p>Jurisdição informada: {source.jurisdiction}{source.state_uf?' / '+source.state_uf:''}</p>
   <p>Registrada por {source.created_by_name}.</p>
   <p className="help">A versão mais recente não torna automaticamente inválidas as
    anteriores; consulte a vigência informada e a fonte oficial para cada caso.</p>
  </section>
  <section className="panel">
   <h2>Versões e evidências ({versions.length})</h2>
   {versions.map(v=><article key={v.id} className="review-event">
    <span className="chip">Versão {v.version} · {normativeVersionLabel(v.valid_from,v.valid_until)}</span>
    <p><strong>Publicação:</strong> {fmt(v.published_on)}</p>
    <p><strong>Vigência informada:</strong> {fmt(v.valid_from)} —
     {' '}{v.valid_until?fmt(v.valid_until):'sem data final registrada'}</p>
    <p><strong>Seção:</strong> {v.source_section}</p>
    <p><strong>Trecho:</strong> {v.excerpt}</p>
    <p><strong>Justificativa:</strong> {v.context_note}</p>
    <p><a href={v.source_url} rel="noopener noreferrer" target="_blank">
     Abrir endereço da versão {v.version} (não verificado)</a></p>
    <p className="help"><strong>Identificador da versão:</strong> <code>{v.id}</code></p>
    <p className="help"><strong>Impressão digital dos metadados:</strong>
     {' '}<code>{v.snapshot_sha256}</code></p>
    <p className="help">Autor: {v.author_name} ·
     {' '}{new Date(v.recorded_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
   </article>)}
  </section>
  <section className="panel">
   <h2>Adicionar versão histórica</h2>
   {actor.role==='admin'&&enabled&&latestVersion>0&&latestVersion<1000?
    <AddNormativeVersion sourceId={id} latestVersion={latestVersion}/>:
    <p className="muted">Somente administradores podem registrar versões
     após homologação e até o limite de 1.000 versões.</p>}
  </section>
 </>;
}
