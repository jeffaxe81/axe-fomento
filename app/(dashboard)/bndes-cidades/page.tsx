import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {todaySaoPaulo} from '@/lib/document-validity.mjs';
import {BndesCityReviewForm} from '@/components/bndes-city-review-form';
import {BNDES_AREAS,BNDES_SOURCE_STATES,BNDES_AVAILABILITY_STATES,
 bndesFilters,bndesHref,bndesReferenceAge} from '@/lib/bndes-cities.mjs';
import {BNDES_CITY_LIST_SQL,BNDES_CITY_STATS_SQL} from '@/lib/bndes-city-sql.mjs';
export const dynamic='force-dynamic';
type Solution={code:string;title:string;area:string;summary:string;source_url:string;
 reference_observed_on:string;revision:number|null;
 source_state:string|null;availability_state:string|null;
 checked_on:string|null;note:string|null;recorded_at:string|null};
type Stats={total:number;municipally_checked:number;without_check:number;requires_followup:number};
type Params={busca?:string|string[];area?:string|string[];fonte?:string|string[];
 disponibilidade?:string|string[];conferida?:string|string[];pagina?:string|string[]};
export default async function BndesCitiesPage({searchParams}:{
 searchParams:Promise<Params>}){
 const actor=await requireSession(),today=todaySaoPaulo();
 const filters=bndesFilters(await searchParams),size=25;
 const [rows,[stats]]=await Promise.all([
  queryForMunicipality<Solution>(actor.municipality_id,BNDES_CITY_LIST_SQL,[
   actor.municipality_id,filters.search,filters.area,filters.sourceState,
   filters.availability,filters.reviewed,size+1,(filters.page-1)*size],actor.id),
  queryForMunicipality<Stats>(actor.municipality_id,BNDES_CITY_STATS_SQL,
   [actor.municipality_id],actor.id)
 ]);
 const entries=rows.slice(0,size),hasNext=rows.length>size;
 const canReview=actor.role==='admin'&&process.env.ENABLE_BNDES_CITY_CATALOG==='yes';
 return <>
  <div className="section-eyebrow">FONTES OFICIAIS · AF-035</div>
  <div className="page-heading"><div>
   <h1>Catálogo BNDES Cidades</h1>
   <p>Soluções vinculadas ao portal oficial, com conferência municipal auditável.</p>
  </div><Link href="/financiadores" className="btn btn-outline">
   Diretório de instituições</Link></div>
  <section className="panel">
   <h2>Fonte institucional identificada ≠ financiamento disponível</h2>
   <p>As páginas são referências identificadas no
    {' '}<a href="https://cidades.bndes.gov.br/" target="_blank"
     rel="noopener noreferrer">portal oficial BNDES Cidades</a>
    . Não verificamos em tempo real as condições de crédito.
    Filtros populacionais, requisitos, custos, documentos, garantias e
    disponibilidade devem ser confirmados no BNDES ou agente financeiro.</p>
   <p className="help">O registro de 07/11/2026 representa o levantamento
    das URLs do portal, não data de aprovação de linha ou liberação de recursos.</p>
   <div className="requirement-stats">
    <div><strong>{stats?.total??0}</strong><span>Referências no catálogo</span></div>
    <div><strong>{stats?.municipally_checked??0}</strong>
     <span>Conferências registradas pelo município</span></div>
    <div><strong>{stats?.without_check??0}</strong>
     <span>Sem conferência municipal</span></div>
    <div><strong>{stats?.requires_followup??0}</strong>
     <span>Fontes a revisar</span></div>
   </div>
  </section>
  <form action="/bndes-cidades" className="filters" method="get">
   <label>Buscar solução
    <input type="search" name="busca" maxLength={100}
     defaultValue={filters.search} placeholder="Ex.: saneamento, escola, mobilidade"/>
   </label>
   <label>Área
    <select name="area" defaultValue={filters.area}>
     <option value="">Todas as áreas</option>
     {Object.entries(BNDES_AREAS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
    </select>
   </label>
   <label>Situação da fonte
    <select name="fonte" defaultValue={filters.sourceState}>
     <option value="">Todas</option>
     {Object.entries(BNDES_SOURCE_STATES).map(([k,v])=>
      <option key={k} value={k}>{v}</option>)}
    </select>
   </label>
   <label>Disponibilidade citada
    <select name="disponibilidade" defaultValue={filters.availability}>
     <option value="">Todas</option>
     {Object.entries(BNDES_AVAILABILITY_STATES).map(([k,v])=>
      <option key={k} value={k}>{v}</option>)}
    </select>
   </label>
   <label>Conferência municipal
    <select name="conferida" defaultValue={filters.reviewed}>
     <option value="">Todas</option>
     <option value="sim">Com conferência</option>
     <option value="nao">Pendente de conferência</option>
    </select>
   </label>
   <button type="submit" className="btn btn-primary">Pesquisar</button>
   <Link href="/bndes-cidades" className="btn btn-outline">Limpar filtros</Link>
  </form>
  <section className="panel">
   <h2>Soluções do BNDES ({entries.length} nesta página)</h2>
   {!entries.length&&<p className="muted">Não há referências para esses filtros.</p>}
   <div className="review-events">
    {entries.map(item=><article key={item.code} className="review-event"
     data-bndes-code={item.code}>
     <div className="small-tags">
      <span className="chip">{BNDES_AREAS[item.area]??item.area}</span>
      <span className="chip">{item.revision?'Revisão municipal '+item.revision:
       'Sem conferência municipal'}</span>
     </div>
     <h3><Link href={'/bndes-cidades/'+item.code}>{item.title}</Link></h3>
     <p>{item.summary}</p>
     <p><strong>Fonte:</strong> {item.source_state?
      BNDES_SOURCE_STATES[item.source_state]:'Página oficial identificada'}</p>
     <p><strong>Disponibilidade:</strong> {item.availability_state?
      BNDES_AVAILABILITY_STATES[item.availability_state]:
      'Não apurada'}</p>
     <p className="help">{bndesReferenceAge(item.checked_on,today)}</p>
     <a href={item.source_url} target="_blank" rel="noopener noreferrer">
      Abrir página de solução no BNDES</a>
    </article>)}
   </div>
   {(filters.page>1||hasNext)&&<nav aria-label="Paginação BNDES"
    className="radar-pagination">
    {filters.page>1&&<Link href={bndesHref(filters,filters.page-1)}
     className="btn btn-outline">Anterior</Link>}
    <span>Página {filters.page}</span>
    {hasNext&&<Link href={bndesHref(filters,filters.page+1)}
     className="btn btn-outline">Próxima</Link>}
   </nav>}
  </section>
  <section className="panel">
   <h2>Conferência em lote · até 20 soluções</h2>
   {canReview&&entries.length?<BndesCityReviewForm
    key={JSON.stringify(filters)} today={today}
    entries={entries.map(x=>({code:x.code,title:x.title,revision:x.revision}))}/>:
    <p className="muted">Conferência reservada a administrador municipal.
     A gravação permanece bloqueada até homologação.</p>}
   <p className="help">O lote é atômico: se uma referência estiver desatualizada,
    nenhuma decisão é gravada, e o responsável deve atualizar a consulta.
    A mesma observação será registrada nas referências selecionadas.</p>
  </section>
 </>;
}
