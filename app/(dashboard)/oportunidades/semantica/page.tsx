import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {searchSemanticCatalog} from '@/lib/semantic-catalog';
import {semanticSelection,semanticHref} from '@/lib/semantic-intent.mjs';
export const dynamic='force-dynamic';
type SearchParams={intencao?:string|string[];tipo?:string|string[];pagina?:string|string[]};

export default async function SemanticOpportunities({searchParams}:{
 searchParams:Promise<SearchParams>
}){
 const user=await requireSession();
 const {intent,mode,page}=semanticSelection(await searchParams);
 const enabled=process.env.ENABLE_SEMANTIC_CATALOG==='yes';
 const result=enabled&&intent?await searchSemanticCatalog(
  user.municipality_id,intent,mode,page,user.id):null;
 return <>
  <div className="section-eyebrow">BUSCA POR INTENÇÃO · AF-031</div>
  <div className="page-heading"><div><h1>Buscar oportunidades por objetivo</h1>
   <p>Encontre temas relacionados em português, além de palavras exatamente iguais.</p>
  </div><Link className="btn btn-outline" href="/oportunidades">Voltar ao radar</Link></div>
  <section className="panel">
   <h2>Como interpretar a pesquisa</h2>
   <p>A busca combina <strong>sinônimos temáticos revisáveis</strong> e análise
    de termos em português pelo PostgreSQL; não utiliza embeddings nem IA generativa.
    A relevância textual não comprova elegibilidade, edital aberto ou
    aderência ao município. Confira cada fonte e as condições oficiais.</p>
   <p><strong>Oportunidades cadastradas</strong> e <strong>programas em curadoria</strong>
    são categorias diferentes. Programas aparecem apenas após revisão municipal;
    não são convertidos automaticamente em oportunidades.</p>
  </section>
  <form className="filters" method="get" action="/oportunidades/semantica">
   <label>Qual problema ou objetivo deseja atender?
    <input type="search" name="intencao" required minLength={3}
     maxLength={120} defaultValue={intent?.input??''}
     placeholder="Ex.: melhorar postos de saúde ou construir creches"/>
   </label>
   <label>Tipo de informação
    <select name="tipo" defaultValue={mode}>
     <option value="oportunidades">Oportunidades cadastradas</option>
     <option value="programas">Programas revisados da minha prefeitura</option>
    </select>
   </label>
   <button className="btn btn-primary" type="submit">Buscar por intenção</button>
   <Link className="btn btn-light" href="/oportunidades/semantica">Limpar</Link>
  </form>
  {!enabled?<section className="panel">
   <p>A busca por intenção ainda não foi homologada para este ambiente.</p>
  </section>:!intent?<section className="panel">
   <p>Digite uma intenção com tema específico. Exemplo:
    “preciso ampliar creches” ou “melhorar o saneamento”.</p>
  </section>:<>
   <div className="results-summary">
    {result?.items.length??0} resultado(s) nesta página · Ordenados por
    relevância textual, recência e identificador estável
    {intent.categories.length>0?' · Temas relacionados: '+intent.categories.join(', '):''}
   </div>
   {mode==='oportunidades'?<div className="opportunity-cards">
    {result?.kind==='oportunidades'&&result.items.map(item=><article
     className="result-card" data-semantic-id={item.id} key={item.id}>
     <div className="result-content">
      <div className="small-tags">
       {item.areas.map(a=><span className="chip" key={a}>{a}</span>)}
       {item.is_example&&<span className="chip demo">FICTÍCIO / TESTE</span>}
      </div>
      <h3>{item.title}</h3><p>{item.provider}</p>
      <p>Relevância textual: {item.relevance} pontos (não é elegibilidade).</p>
      <p className="help">Data do cadastro:
       {' '}{new Date(item.created_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}.
       Data de consulta à fonte: não disponível.</p>
      {item.source_url?.startsWith('https://')&&<a href={item.source_url}
       target="_blank" rel="noopener noreferrer">
       Abrir fonte indicada no cadastro (não verificada)</a>}
      {!item.source_url&&<p className="help">Fonte de referência não informada.</p>}
     </div>
    </article>)}
   </div>:<section className="panel">
    <h2>Programas revisados pelo município</h2>
    {result?.kind==='programas'&&result.items.map(p=><article className="review-event"
     data-semantic-id={p.id} key={p.id}>
     <span className="chip">Programa revisado, não edital aberto</span>
     <h3>{p.title}</h3><p>{p.provider}</p>
     <p className="help">Código: {p.external_id} · versão interna {p.version}</p>
     <p>Relevância textual: {p.relevance} pontos.</p>
     <p className="help">Última consulta/observação da fonte registrada:
      {' '}{new Date(p.last_seen_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}.
      Não implica disponibilidade atual de recursos.</p>
     <a href={p.source_url} target="_blank" rel="noopener noreferrer">
      Endpoint da fonte declarada (não é link para edital específico)</a>
     {user.role==='admin'&&<p><Link href={'/fontes/'+p.id}>
      Ver histórico de versões e revisão</Link></p>}
    </article>)}
   </section>}
   {!result?.items.length&&<div className="empty-state">
    Nenhum registro relacionado à intenção nesta página.
    A pesquisa não substitui consulta aos órgãos financiadores.
   </div>}
   {result&&(page>1||result.hasNext)&&<nav className="radar-pagination"
    aria-label="Paginação da busca por intenção">
    {page>1&&<Link className="btn btn-outline" href={semanticHref(intent,mode,page-1)}>
     Anterior</Link>}
    <span>Página {page}</span>
    {result.hasNext&&<Link className="btn btn-outline"
     href={semanticHref(intent,mode,page+1)}>Próxima</Link>}
   </nav>}
  </>}
 </>;
}
