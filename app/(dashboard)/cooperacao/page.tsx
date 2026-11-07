import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {LIST_COOPERATION_SQL} from '@/lib/cooperation-sql.mjs';
import {CALL_LANGUAGE,CALL_MODALITY,CALL_SCOPE,CALL_STATE,ROUTE_TYPE,ROUTE_STATE}
 from '@/lib/cooperation-labels.mjs';
import {CooperationCallForm,CooperationRouteForm} from '@/components/cooperation-forms';
export const dynamic='force-dynamic';
type Route={id:string;type:string;contact:string;url:string;verification:string;
 checked_on:string|null;steps:string};
type Call={id:string;call_code:string;title:string;institution:string;
 language_code:string;scope_code:string;modality:string;official_url:string;
 review_state:string;checked_on:string|null;notes:string;routes:Route[]};
export default async function InternationalCooperation(){
 const actor=await requireSession();
 const calls=await queryForMunicipality<Call>(actor.municipality_id,
  LIST_COOPERATION_SQL,[actor.municipality_id],actor.id);
 const canWrite=actor.role==='admin'&&process.env.ENABLE_INTERNATIONAL_COOPERATION==='yes';
 return <>
  <div className="section-eyebrow">COOPERAÇÃO INTERNACIONAL · AF-037/038</div>
  <div className="page-heading"><div><h1>Radar e rotas de candidatura</h1>
   <p>Referências municipais por instituição, idioma, abrangência e modalidade.</p>
  </div></div>
  <section className="panel">
   <h2>Referências informadas não são chamadas abertas</h2>
   <p>Este módulo registra informações fornecidas pela equipe municipal.
    Nenhum item é validado em tempo real ou automaticamente. A página oficial
    deve ser consultada para confirmar edital, disponibilidade de recursos,
    elegibilidade e a rota correta. Contratações de fornecedores e vagas
    profissionais não devem ser interpretadas como financiamentos municipais.</p>
  </section>
  <section className="panel">
   <h2>Referências municipais ({calls.length} exibidas)</h2>
   {!calls.length&&<p>Nenhuma referência cadastrada para esta prefeitura.</p>}
   {calls.map(c=><article key={c.id} className="review-event" data-cooperation-call={c.id}>
    <span className="chip">{CALL_STATE[c.review_state]}</span>
    <h3>{c.call_code} · {c.title}</h3>
    <p><strong>Instituição:</strong> {c.institution} ·
     {' '}{CALL_LANGUAGE[c.language_code]} · {CALL_SCOPE[c.scope_code]} ·
     {' '}{CALL_MODALITY[c.modality]}</p>
    <p>{c.notes}</p>
    <p><a href={c.official_url} target="_blank" rel="noopener noreferrer">
     Consultar a referência declarada</a></p>
    <h4>Rotas de candidatura registradas ({c.routes.length})</h4>
    {!c.routes.length&&<p>Nenhuma rota foi conferida até o momento.</p>}
    {c.routes.map(r=><div className="review-event" key={r.id} data-route={r.id}>
     <strong>{ROUTE_TYPE[r.type]} · {ROUTE_STATE[r.verification]}</strong>
     <p>Contato: {r.contact}</p>
     <p>{r.steps}</p>
     <p><a href={r.url} target="_blank" rel="noopener noreferrer">
      Abrir página institucional de contato</a></p>
    </div>)}
    {canWrite&&<details><summary>Registrar outra rota para esta referência</summary>
     <CooperationRouteForm callId={c.id}/></details>}
   </article>)}
  </section>
  <section className="panel">
   <h2>Cadastrar nova referência de cooperação</h2>
   {canWrite?<CooperationCallForm/>:<p className="muted">
    Cadastro reservado a administrador municipal após homologação.</p>}
  </section>
 </>;
}