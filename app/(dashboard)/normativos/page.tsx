import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {CreateNormativeSource} from '@/components/normative-forms';
import {normativeVersionLabel} from '@/lib/normative-source.mjs';
export const dynamic='force-dynamic';
type Source={id:string;reference_code:string;title:string;jurisdiction:string;
 state_uf:string|null;created_at:string;latest_version:number;
 valid_from:string;valid_until:string|null;source_url:string};
export default async function NormativeList(){
 const actor=await requireSession();
 const sources=await queryForMunicipality<Source>(actor.municipality_id,
  `SELECT s.id,s.reference_code,s.title,s.jurisdiction,s.state_uf,s.created_at,
   last.version AS latest_version,to_char(last.valid_from,'YYYY-MM-DD') AS valid_from,
   to_char(last.valid_until,'YYYY-MM-DD') AS valid_until,last.source_url
   FROM municipal_normative_sources s
   JOIN LATERAL(SELECT v.version,v.valid_from,v.valid_until,v.source_url
    FROM municipal_normative_versions v WHERE v.source_id=s.id
    AND v.municipality_id=s.municipality_id ORDER BY v.version DESC LIMIT 1) last ON true
   WHERE s.municipality_id=$1 ORDER BY s.created_at DESC,s.id DESC LIMIT 150`,
  [actor.municipality_id],actor.id);
 const enabled=process.env.ENABLE_NORMATIVE_REGISTRY==='yes';
 return <>
  <div className="section-eyebrow">INTELIGÊNCIA JURÍDICA · AF-028</div>
  <div className="page-heading"><div><h1>Base normativa versionada</h1>
   <p>Referências documentadas pela equipe municipal — consulta histórica auditável</p>
  </div></div>
  <section className="panel">
   <h2>Como interpretar</h2>
   <p>Estes registros são declarações da equipe e <strong>não comprovam</strong>
    autenticidade, vigência legal, aplicabilidade ao projeto ou parecer jurídico.
    A consulta à fonte indicada é indispensável.</p>
  </section>
  <section className="panel">
   <h2>Referências do município ({sources.length})</h2>
   {!sources.length&&<p className="muted">Nenhuma referência normativa registrada.</p>}
   <div className="review-events">
    {sources.map(s=><article key={s.id} className="review-event">
     <span className="chip">{s.jurisdiction}{s.state_uf?' / '+s.state_uf:''} · v{s.latest_version}</span>
     <h3><Link href={'/normativos/'+s.id}>{s.reference_code} — {s.title}</Link></h3>
     <p>{normativeVersionLabel(s.valid_from,s.valid_until)}</p>
     <p><a href={s.source_url} target="_blank" rel="noopener noreferrer">
      Consultar fonte indicada (não verificada)</a></p>
    </article>)}
   </div>
   {sources.length===150&&<p className="note">Lista limitada às 150 referências mais recentes.
    Consulte o banco auditado para um histórico completo.</p>}
  </section>
  <section className="panel">
   <h2>Nova referência</h2>
   {actor.role==='admin'&&enabled?<CreateNormativeSource/>:
    <p className="muted">Registro reservado ao administrador do município e
     desabilitado até homologação.</p>}
  </section>
 </>;
}
