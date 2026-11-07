import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {classifyObservation,compareOffers,operationalOutcomes,alertsFor} from '@/lib/funding-pipeline.mjs';
import {FundingSourceImport,FundingObservationForm,FundingCaseForm,FundingAlertForm} from '@/components/funding-forms';
export const dynamic='force-dynamic';
type Offer={id:string;source:string;external_code:string;title:string;source_url:string;modality:string;
 observation_kind:string;reference_status:string;opens_on:string|null;closes_on:string|null;
 checked_on:string|null;terms:{annualRateBps?:number|null;termMonths?:number|null};created_at:string};
type Case={id:string;project_id:string;project_title:string;offer_title:string;source:string;
 source_url:string;created_at:string};
type Project={id:string;title:string};
type Event={case_id:string;revision:number;event_kind:string;evidence_url:string|null;value_cents:string|null};
type Alert={modality:string;days_ahead:number};
const money=(cents:string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
 .format(Number(cents)/100);
export default async function MunicipalFunding({searchParams}:{searchParams:Promise<{comparar?:string|string[]}>}){
 const actor=await requireSession();const enabled=process.env.ENABLE_FUNDING_PIPELINE==='yes';
 const [offers,cases,projects,events,subscriptions]=await Promise.all([
  queryForMunicipality<Offer>(actor.municipality_id,
   'SELECT DISTINCT ON (source,external_code) id,source,external_code,title,source_url,modality,'+
   'observation_kind,reference_status,opens_on::text AS opens_on,closes_on::text AS closes_on,'+
   'checked_on::text AS checked_on,terms,created_at FROM funding_observations WHERE municipality_id=$1 '+
   'ORDER BY source,external_code,created_at DESC,id DESC LIMIT 150',[actor.municipality_id],actor.id),
  queryForMunicipality<Case>(actor.municipality_id,
   'SELECT c.id,c.project_id,p.title AS project_title,o.title AS offer_title,'+
   'o.source,o.source_url,c.created_at FROM funding_cases c '+
   'JOIN projects p ON p.id=c.project_id AND p.municipality_id=c.municipality_id '+
   'JOIN funding_observations o ON o.id=c.observation_id AND o.municipality_id=c.municipality_id '+
   'WHERE c.municipality_id=$1 ORDER BY c.created_at DESC,c.id DESC LIMIT 150',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Project>(actor.municipality_id,
   'SELECT id,title FROM projects WHERE municipality_id=$1 ORDER BY created_at DESC LIMIT 100',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Event>(actor.municipality_id,
   'SELECT case_id,revision,event_kind,evidence_url,value_cents '+
   'FROM funding_case_events WHERE municipality_id=$1 ORDER BY created_at DESC LIMIT 1000',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Alert>(actor.municipality_id,
   'SELECT modality,days_ahead FROM funding_alert_subscriptions '+
   'WHERE municipality_id=$1 AND user_id=$2 AND is_active=true',
   [actor.municipality_id,actor.id],actor.id)
 ]);
 const summary=operationalOutcomes(cases,events);
 const alerts=subscriptions.flatMap(s=>alertsFor(offers.filter(o=>
  s.modality==='todas'||s.modality===o.modality),s.days_ahead));
 const uniqueAlerts=[...new Map(alerts.map(a=>[a.id,a])).values()];
 const search=await searchParams;
 const chosen=(Array.isArray(search.comparar)?search.comparar:[search.comparar]).filter(
  (v):v is string=>typeof v==='string').slice(0,3);
 const selected=chosen.length?offers.filter(o=>chosen.includes(o.id)).slice(0,3):offers.slice(0,3);
 const today=new Date().toISOString().slice(0,10);
 const compare=compareOffers(selected,today);
 return <>
  <div className="section-eyebrow">CAPTAÇÃO DE RECURSOS · AF-051 A AF-065</div>
  <div className="page-heading"><div><h1>Jornada de financiamento municipal</h1>
   <p>Da consulta de linhas públicas ao dossiê, protocolo e controle dos resultados.</p></div>
   <Link href="/projetos" className="btn btn-outline">Carteira de projetos</Link></div>
  <section className="panel">
   <h2>Orientação de uso</h2>
   <p><strong>Etapa de homologação: {enabled?'funcionalidades habilitadas neste ambiente':'escrita bloqueada'}.</strong> O AXE
    não concede crédito, não substitui consulta oficial e não faz protocolo automático.
    Programas de dados abertos não são necessariamente editais vigentes.
    Todo resultado financeiro mostrado abaixo depende dos registros e evidências informados pelo município.</p>
  </section>
  <section className="panel">
   <h2>Indicadores de captação declarados</h2>
   <div className="stats-grid">
    <article className="stat-card"><strong>{offers.length}</strong><span>Referências consultáveis</span></article>
    <article className="stat-card"><strong>{summary.projects}</strong><span>Candidaturas internas</span></article>
    <article className="stat-card"><strong>{summary.awarded}</strong><span>Aprovações informadas com evidência</span></article>
    <article className="stat-card"><strong>{money(summary.declaredAwardCents)}</strong><span>Valores aprovados declarados</span></article>
    <article className="stat-card"><strong>{money(summary.declaredPaidCents)}</strong><span>Desembolsos declarados</span></article>
   </div>
   <p className="help">Não há conciliação bancária ou confirmação automática pelo financiador.
    Exportação para conferência: <a href="/api/funding/reports?format=csv">Baixar CSV de registros declarados</a>.</p>
  </section>
  <section className="panel">
   <h2>AF-051–053 · Catálogo e consulta a referências oficiais</h2>
   {actor.role==='admin'?<FundingSourceImport enabled={enabled}/>:
    <p className="muted">Atualização de referências restrita ao administrador.</p>}
   <div className="review-events">{offers.slice(0,50).map(item=><article key={item.id}
    className="review-event">
     <div className="small-tags">
      <span className="chip">{item.source}</span><span className="chip">{item.modality}</span>
      <span className="chip">{classifyObservation(item,today)}</span></div>
     <h3>{item.title}</h3><p>Código: {item.external_code} · Conferência: {item.checked_on??'Não informada'}
      · Prazo: {item.closes_on??'Não informado'}</p>
     <a href={item.source_url} target="_blank" rel="noopener noreferrer">Consultar referência oficial</a>
    </article>)}</div>
   {!offers.length&&<p className="muted">Nenhuma referência cadastrada. Inicie uma consulta ou registre uma referência verificada.</p>}
  </section>
  <section className="panel">
   <h2>AF-054 e AF-057 · Conferência de validade e comparação</h2>
   <p>Comparação indicativa de até três referências, sem inferir concessão nem condições ausentes.</p>
   <form action="/captacao" method="get">
    <fieldset><legend>Selecione até três referências para comparar</legend>
     {offers.slice(0,30).map(o=><label key={o.id} style={{display:'inline-block',margin:'0 1rem .5rem 0'}}>
      <input type="checkbox" name="comparar" value={o.id} defaultChecked={selected.some(s=>s.id===o.id)}/>
      {' '+o.title}</label>)}
    </fieldset>
    <button className="btn btn-outline" type="submit">Comparar seleção</button>
   </form>
   <div className="table-scroll" tabIndex={0} role="region" aria-label="Comparativo de fontes">
    <table><thead><tr><th scope="col">Fonte</th><th scope="col">Condição</th><th scope="col">Status</th><th scope="col">Prazo</th><th scope="col">Taxa informada</th><th scope="col">Prazo de crédito</th></tr></thead>
     <tbody>{compare.map((x:{id:string;title:string;modality:string;status:string;closesOn:string|null;annualRateBps:number|null;termMonths:number|null})=><tr key={x.id}><td>{x.title}</td><td>{x.modality}</td>
      <td>{x.status}</td><td>{x.closesOn??'Não apurado'}</td>
      <td>{x.annualRateBps!=null?(x.annualRateBps/100).toFixed(2)+'% a.a.':'Não apurada'}</td><td>{x.termMonths??'Não apurado'}</td></tr>)}</tbody></table>
   </div>
  </section>
  <section className="panel">
   <h2>AF-055 · Alertas de prazos na plataforma</h2>
   <FundingAlertForm enabled={enabled}/>
   <p>{uniqueAlerts.length} oportunidades potencialmente abertas dentro das janelas cadastradas.
    Reconfirme a fonte oficial antes de qualquer medida.</p>
   {uniqueAlerts.slice(0,20).map(a=><p key={a.id}><strong>{a.title}</strong> — data declarada: {a.deadline}</p>)}
  </section>
  <section className="panel">
   <h2>AF-056 a AF-065 · Vincular financiamento a projeto</h2>
   <p className="help">Somente referências declaradas conferidas nos últimos 30 dias podem
    iniciar uma candidatura. Programas observados e publicações CAPAG não são ofertas.</p>
   <FundingCaseForm enabled={enabled} projects={projects} observations={
    offers.filter(o=>classifyObservation(o,today)==='potencialmente_aberta_verificar_fonte'||
     classifyObservation(o,today)==='sem_prazo_comprovado')
   }/>
   <div className="review-events">{cases.map(item=><article key={item.id} className="review-event">
    <h3><Link href={'/captacao/'+item.id}>{item.project_title}</Link></h3>
    <p>{item.offer_title} · {item.source}</p>
    <Link className="btn btn-outline" href={'/captacao/'+item.id}>Abrir jornada e dossiê</Link>
   </article>)}</div>
  </section>
  {actor.role==='admin'&&<section className="panel">
   <h2>Registrar conferência de referência (AF-054)</h2>
   <FundingObservationForm enabled={enabled}/>
  </section>}
 </>;
}
