import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {CreateFinancierForm} from '@/components/financier-forms';
import {LIST_FINANCIERS_SQL} from '@/lib/financier-directory-sql.mjs';
import {FINANCIER_TYPES,FINANCIER_MODALITIES,FINANCIER_AREAS,CHECK_LABELS,
 financierFilters,financierHref} from '@/lib/financier-directory.mjs';

export const dynamic='force-dynamic';
type Filters={busca?:string|string[];area?:string|string[];
 modalidade?:string|string[];pagina?:string|string[]};
type Financier={id:string;reference_code:string;name:string;institution_type:string;
 financing_modalities:string[];thematic_areas:string[];version:number;
 reference_url:string;reference_title:string;reference_section:string;
 check_status:string;checked_on:string|null;recorded_at:string};
export default async function FinancierDirectory({searchParams}:{
 searchParams:Promise<Filters>
}){
 const actor=await requireSession();
 const filters=financierFilters(await searchParams),limit=25;
 const rows=await queryForMunicipality<Financier>(actor.municipality_id,
  LIST_FINANCIERS_SQL,[actor.municipality_id,filters.search,filters.area,
   filters.modality,limit+1,(filters.page-1)*limit],actor.id);
 const list=rows.slice(0,limit),hasNext=rows.length>limit;
 const enabled=process.env.ENABLE_FINANCIER_DIRECTORY==='yes';
 return <>
  <div className="section-eyebrow">REDE NACIONAL · AF-034</div>
  <div className="page-heading"><div>
   <h1>Diretório de financiadores nacionais</h1>
   <p><Link href="/bndes-cidades">Consultar soluções BNDES Cidades com fontes oficiais</Link></p>
   <p>Instituições e referências registradas pela prefeitura, por modalidade e área.</p>
  </div></div>
  <section className="panel">
   <h2>Como interpretar</h2>
   <p>Este catálogo é <strong>municipal e declaratório</strong>: não contém
    lista oficial de editais abertos nem confirma linhas, prazos,
    taxas, repasses, elegibilidade ou disponibilidade de recursos.
    A data indicada registra uma consulta humana informada pela equipe,
    não uma verificação automática do sistema.</p>
  </section>
  <form className="filters" action="/financiadores" method="get">
   <label>Pesquisar nome ou código
    <input name="busca" type="search" maxLength={100} defaultValue={filters.search}
     placeholder="Nome da instituição"/>
   </label>
   <label>Área temática
    <select name="area" defaultValue={filters.area}>
     <option value="">Todas</option>
     {Object.entries(FINANCIER_AREAS).map(([key,label])=>
      <option key={key} value={key}>{label}</option>)}
    </select>
   </label>
   <label>Modalidade
    <select name="modalidade" defaultValue={filters.modality}>
     <option value="">Todas</option>
     {Object.entries(FINANCIER_MODALITIES).map(([key,label])=>
      <option key={key} value={key}>{label}</option>)}
    </select>
   </label>
   <button type="submit" className="btn btn-primary">Filtrar</button>
   <Link href="/financiadores" className="btn btn-light">Limpar</Link>
  </form>
  <section className="panel">
   <h2>Instituições cadastradas ({list.length} nesta página)</h2>
   {!list.length&&<p className="muted">Nenhuma instituição registrada para estes filtros.</p>}
   <div className="review-events">
    {list.map(item=><article key={item.id} className="review-event"
     data-financier-id={item.id}>
     <div className="small-tags">
      <span className="chip">{FINANCIER_TYPES[item.institution_type]??'Categoria informada'}</span>
      <span className="chip">Referência v{item.version}</span>
      <span className="chip">{CHECK_LABELS[item.check_status]??'Situação desconhecida'}</span>
     </div>
     <h3><Link href={'/financiadores/'+item.id}>
      {item.reference_code} — {item.name}</Link></h3>
     <p><strong>Modalidades informadas:</strong> {item.financing_modalities.map(
      m=>FINANCIER_MODALITIES[m]??m).join(', ')}</p>
     <p><strong>Áreas informadas:</strong> {item.thematic_areas.map(
      a=>FINANCIER_AREAS[a]??a).join(', ')}</p>
     <p><strong>Data de consulta humana:</strong> {item.checked_on?
      item.checked_on.split('-').reverse().join('/'):'Não registrada'}</p>
     <a href={item.reference_url} target="_blank" rel="noopener noreferrer">
      Abrir referência declarada (não verificada automaticamente)</a>
    </article>)}
   </div>
   {list.length===25&&<p className="help">Até 25 instituições por página.
    A lista contempla apenas as referências do município ativo.</p>}
   {(filters.page>1||hasNext)&&<nav className="radar-pagination"
    aria-label="Paginação de financiadores">
    {filters.page>1&&<Link className="btn btn-outline"
     href={financierHref(filters,filters.page-1)}>Anterior</Link>}
    <span>Página {filters.page}</span>
    {hasNext&&<Link className="btn btn-outline"
     href={financierHref(filters,filters.page+1)}>Próxima</Link>}
   </nav>}
  </section>
  <section className="panel">
   <h2>Adicionar instituição</h2>
   {actor.role==='admin'&&enabled?<CreateFinancierForm/>:
    <p className="muted">Cadastro restrito ao administrador municipal e
     desabilitado até homologação.</p>}
  </section>
 </>;
}
