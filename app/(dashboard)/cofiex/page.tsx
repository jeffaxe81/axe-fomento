import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {COFIEX_REFERENCES_SQL} from '@/lib/cofiex-sql.mjs';
import {COFIEX_CATEGORIES} from '@/lib/cofiex-labels.mjs';
export const dynamic='force-dynamic';

type Reference={code:string;title:string;category:string;
 source_url:string;description:string;identified_on:string};
export default async function CofiexCatalog(){
 const actor=await requireSession();
 const refs=await queryForMunicipality<Reference>(actor.municipality_id,
  COFIEX_REFERENCES_SQL,[],actor.id);
 return <>
  <div className="section-eyebrow">FINANCIAMENTO EXTERNO · AF-036</div>
  <div className="page-heading"><div><h1>Catálogo COFIEX</h1>
   <p>Referências, legislação, documentos e etapas de consulta de financiamento externo.</p>
  </div><Link href="/projetos" className="btn btn-outline">
   Acompanhar projetos municipais</Link></div>
  <section className="panel">
   <h2>Referências oficiais identificadas — não são ofertas de crédito</h2>
   <p>O catálogo organiza fontes públicas do Ministério do Planejamento e do
    Portal de Financiamento Externo (PFE). Não confirma elegibilidade,
    prazos, taxa, disponibilidade, aprovação ou contratação de financiamento.
    Confira o conteúdo e a redação mais recente de cada fonte antes de agir.</p>
   <p>A apresentação de um pleito ocorre no
    {' '}<a href="https://pfe.sistema.gov.br/" target="_blank"
     rel="noopener noreferrer">PFE oficial</a>
    {' '}por representante devidamente autorizado, não pelo AXE Fomento.
    Não enviamos dados ao PFE.</p>
   <p className="help">Fontes identificadas em 07/11/2026.
    A data não equivale a verificação diária da legislação ou do calendário.</p>
  </section>
  <section className="panel">
   <h2>Fontes oficiais ({refs.length})</h2>
   <div className="review-events">
    {refs.map(r=><article key={r.code} className="review-event" data-cofiex-reference={r.code}>
     <span className="chip">{COFIEX_CATEGORIES[r.category]??r.category}</span>
     <h3>{r.title}</h3><p>{r.description}</p>
     <p><a href={r.source_url} target="_blank" rel="noopener noreferrer">
      Abrir referência na fonte oficial</a></p>
     <p className="help">Levantamento editorial: {r.identified_on.split('-').reverse().join('/')}</p>
    </article>)}
   </div>
  </section>
  <section className="panel">
   <h2>Fluxo oficial e limites do sistema</h2>
   <p>O AXE pode organizar consultas preparatórias,
    mas reunião técnica, deliberação, negociação e eventual
    contratação dependem dos órgãos competentes e do PFE.
    Para controlar internamente essas etapas, abra
    o acompanhamento COFIEX na ficha de um projeto municipal.</p>
   <p><a href="https://www.gov.br/planejamento/pt-br/assuntos/assuntos-internacionais-e-desenvolvimento/cofiex/reunioes/reunioes-da-comissao-de-financiamentos-externos-cofiex"
    target="_blank" rel="noopener noreferrer">
    Conferir datas e limites da reunião no calendário oficial</a></p>
  </section>
 </>;
}
