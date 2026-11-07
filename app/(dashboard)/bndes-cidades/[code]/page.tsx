import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {todaySaoPaulo} from '@/lib/document-validity.mjs';
import {BndesCityReviewForm} from '@/components/bndes-city-review-form';
import {BNDES_AREAS,BNDES_SOURCE_STATES,BNDES_AVAILABILITY_STATES,
 bndesReferenceAge} from '@/lib/bndes-cities.mjs';
import {BNDES_CITY_HISTORY_SQL} from '@/lib/bndes-city-sql.mjs';
export const dynamic='force-dynamic';
type Solution={code:string;title:string;area:string;summary:string;source_url:string;
 reference_observed_on:string};
type Review={id:string;revision:number;source_state:string;availability_state:string;
 checked_on:string;note:string;source_url_snapshot:string;snapshot_sha256:string;
 recorded_at:string;reviewer_name:string};
export default async function BndesCityDetail({params}:{
 params:Promise<{code:string}>}){
 const actor=await requireSession(),{code}=await params;
 if(!/^[a-z0-9-]{8,120}$/.test(code))notFound();
 const [entry]=await queryForMunicipality<Solution>(actor.municipality_id,
  `SELECT code,title,area,summary,source_url,
   to_char(reference_observed_on,'YYYY-MM-DD') AS reference_observed_on
   FROM bndes_city_solutions WHERE code=$1::text`,[code],actor.id);
 if(!entry)notFound();
 const reviews=await queryForMunicipality<Review>(actor.municipality_id,
  BNDES_CITY_HISTORY_SQL,[actor.municipality_id,code],actor.id);
 const current=reviews[0],today=todaySaoPaulo();
 const canReview=process.env.ENABLE_BNDES_CITY_CATALOG==='yes'&&actor.role==='admin'
  &&(!current||current.revision<1000);
 const stamp=(s:string)=>new Date(s).toLocaleString('pt-BR',
  {timeZone:'America/Sao_Paulo'});
 const date=(s:string)=>s.split('-').reverse().join('/');
 return <>
  <div className="section-eyebrow">CATÁLOGO BNDES · AF-035</div>
  <div className="page-heading"><div><h1>{entry.title}</h1>
   <p>{BNDES_AREAS[entry.area]} · Fonte oficial identificada</p></div>
   <Link href="/bndes-cidades" className="btn btn-outline">Voltar ao catálogo</Link>
  </div>
  <section className="panel">
   <h2>Referência institucional</h2>
   <p>{entry.summary}</p>
   <p><strong>Data do levantamento da referência:</strong>
    {' '}{date(entry.reference_observed_on)}</p>
   <p><a href={entry.source_url} target="_blank" rel="noopener noreferrer">
    Consultar solução no site oficial BNDES Cidades</a></p>
   <p className="note">A inclusão desta fonte não certifica que recursos
    estejam disponíveis, que o município seja elegível, nem que
    determinada taxa ou prazo estejam vigentes. Confirme diretamente
    com o BNDES e, quando cabível, a instituição financeira.</p>
   <p>Para avaliar o pedido, consulte também a
    {' '}<a href="https://www.bndes.gov.br/wps/portal/site/home/onde-atuamos/municipios"
     target="_blank" rel="noopener noreferrer">
     orientação oficial do BNDES aos municípios</a>, incluindo
    habilitação, orçamento, cronograma e documentação técnica.</p>
  </section>
  <section className="panel">
   <h2>Conferência municipal da fonte</h2>
   <p><strong>Última situação:</strong> {current?
    BNDES_SOURCE_STATES[current.source_state]:'Sem conferência municipal'}</p>
   <p><strong>Disponibilidade informada:</strong> {current?
    BNDES_AVAILABILITY_STATES[current.availability_state]:'Não apurada'}</p>
   <p className="help">{bndesReferenceAge(current?.checked_on??null,today)}</p>
   {canReview?<BndesCityReviewForm compact today={today} entries={[{
    code,title:entry.title,revision:current?.revision??null
   }]}/>:
    <p className="muted">Alterações reservadas a administrador municipal,
     com a funcionalidade homologada.</p>}
  </section>
  <section className="panel">
   <h2>Histórico imutável de conferências ({reviews.length} exibidas)</h2>
   {!reviews.length&&<p>Não existe conferência municipal registrada
    para esta referência.</p>}
   {reviews.map(r=><article key={r.id} className="review-event"
    data-bndes-revision={r.revision}>
    <span className="chip">Revisão {r.revision} ·
     {' '}{BNDES_SOURCE_STATES[r.source_state]}</span>
    <p><strong>Disponibilidade observada:</strong>
     {' '}{BNDES_AVAILABILITY_STATES[r.availability_state]}</p>
    <p><strong>Consulta realizada em:</strong> {date(r.checked_on)}</p>
    <p><strong>Nota:</strong> {r.note}</p>
    <p className="help">Responsável: {r.reviewer_name} ·
     {' '}Registro: {stamp(r.recorded_at)}</p>
    <p className="help">SHA-256 dos metadados declarados:
     {' '}{r.snapshot_sha256}</p>
   </article>)}
   {reviews.length===100&&<p className="note">Exibidas até 100 revisões;
    as anteriores continuam armazenadas no banco.</p>}
  </section>
 </>;
}
