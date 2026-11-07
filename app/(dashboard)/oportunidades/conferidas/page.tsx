import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {radarReferenceDate} from '@/lib/opportunity-deadline.mjs';
import {classifyObservation,municipalityOfferCompatibility} from '@/lib/funding-pipeline.mjs';
export const dynamic='force-dynamic';
type Observed={
 id:string;source:string;external_code:string;title:string;source_url:string;
 modality:string;observation_kind:string;reference_status:string;
 opens_on:string|null;closes_on:string|null;checked_on:string|null;created_at:string;
 terms:{minimumPopulation?:number;thematicAreas?:string[]};
};
type Filter={busca?:string|string[];modalidade?:string|string[];situacao?:string|string[]};
const sourceLabel:Record<string,string>={
 transferegov:'Transferegov',bndes:'BNDES',tesouro_capag:'Tesouro/CAPAG',
 other_official:'Outro portal oficial'
};
const statusLabel:Record<string,string>={
 potencialmente_aberta_verificar_fonte:'Potencialmente aberta — reconfirmar',
 sem_prazo_comprovado:'Revisada, mas sem prazo comprovado',
 consulta_nao_comprovada:'Conferência sem data',
 verificacao_desatualizada:'Conferência desatualizada',
 prazo_encerrado:'Prazo informado encerrado',
 inicio_futuro:'Início futuro segundo cadastro',
 referencia_sem_oferta_confirmada:'Referência — não é edital confirmado',
 evidencia_de_edital_pendente:'Aguardando evidência do edital específico',
 data_invalida:'Data de avaliação inválida'
};
const value=(s:string|string[]|undefined)=>typeof s==='string'?s:Array.isArray(s)?s[0]??'':'';
export default async function VerifiedRadar({searchParams}:{searchParams:Promise<Filter>}){
 const actor=await requireSession();
 const filters=await searchParams;
 const term=value(filters.busca).replaceAll('\0','').trim().slice(0,120).toLocaleLowerCase('pt-BR');
 const modality=value(filters.modalidade);
 const situation=value(filters.situacao);
 const [[municipality],observations]=await Promise.all([
  queryForMunicipality<{name:string;population:number|null;priority_areas:string[]}>(actor.municipality_id,
   'SELECT name,population,priority_areas FROM municipalities WHERE id=$1',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Observed>(actor.municipality_id,
   'SELECT * FROM (SELECT DISTINCT ON (source,external_code) id,source,external_code,title,'+
   'source_url,modality,observation_kind,reference_status,opens_on::text AS opens_on,'+
   'closes_on::text AS closes_on,checked_on::text AS checked_on,created_at,terms '+
   'FROM funding_observations WHERE municipality_id=$1 '+
   'ORDER BY source,external_code,created_at DESC,id DESC) latest '+
   'ORDER BY created_at DESC,id DESC LIMIT 200',
   [actor.municipality_id],actor.id)
 ]);
 const today=radarReferenceDate().toISOString().slice(0,10);
 const all=observations.map(item=>({
  ...item,state:classifyObservation(item,today),
  compatible:municipalityOfferCompatibility(item,municipality)
 }));
 const current=all.filter(x=>x.state==='potencialmente_aberta_verificar_fonte').length;
 const reviewed=all.filter(x=>x.observation_kind==='oportunidade_conferida'&&
  x.reference_status==='conferida_por_operador').length;
 const listed=all.filter(o=>(!term||[o.title,o.source,o.external_code].some(t=>t.toLocaleLowerCase('pt-BR').includes(term)))&&
  (!modality||o.modality===modality)&&
  (!situation||(situation==='current'?o.state==='potencialmente_aberta_verificar_fonte':
   situation==='reviewed'?o.observation_kind==='oportunidade_conferida'&&o.reference_status==='conferida_por_operador':
   situation==='other'?o.state!=='potencialmente_aberta_verificar_fonte':true)));
 return <>
  <div className="section-eyebrow">V1 · RADAR COM EVIDÊNCIAS</div>
  <div className="page-heading"><div><h1>Fontes conferidas e referências</h1>
   <p>Informações da curadoria municipal, separadas dos editais fictícios de demonstração.</p></div>
   <div className="radar-actions"><Link href="/evolucao" className="btn btn-outline">Evolução V1–V4</Link>
    <Link href="/captacao" className="btn btn-outline">Jornada de captação</Link></div>
  </div>
  <section className="panel">
   <h2>Qualidade das observações</h2>
   <div className="stats-grid">
    <article className="stat-card"><strong>{all.length}</strong><span>Referências municipais</span></article>
    <article className="stat-card"><strong>{reviewed}</strong><span>Conferidas por responsável</span></article>
    <article className="stat-card"><strong>{current}</strong><span>Potencialmente abertas, não confirmadas pela plataforma</span></article>
   </div>
   <p className="note"><strong>Atenção:</strong> conferir uma referência não é prova de edital aberto,
    aprovação de crédito ou elegibilidade. O sistema não consultou o processo oficial no momento desta página.
    A classificação depende de informação registrada por usuários municipais.</p>
  </section>
  <form method="get" action="/oportunidades/conferidas" className="filters">
   <label>Buscar referência<input type="search" name="busca" defaultValue={value(filters.busca)}
    placeholder="Título, origem ou código" maxLength={120}/></label>
   <label>Modalidade<select name="modalidade" defaultValue={modality}>
    <option value="">Todas</option><option value="credito">Crédito</option>
    <option value="convenio">Convênio</option><option value="transferencia">Transferência</option>
    <option value="cooperacao">Cooperação</option><option value="outro">Outra</option>
   </select></label>
   <label>Situação<select name="situacao" defaultValue={situation}>
    <option value="">Todos os registros</option><option value="current">Potencialmente abertas</option>
    <option value="reviewed">Conferidas internamente</option><option value="other">A revisar/sem vigência</option>
   </select></label>
   <button type="submit" className="btn btn-primary">Filtrar</button>
   <Link className="btn btn-outline" href="/oportunidades/conferidas">Limpar</Link>
  </form>
  <section className="panel">
   <h2>Referências registradas — {listed.length}</h2>
   <div className="review-events">{listed.map(item=><article key={item.id} className="review-event">
    <div className="small-tags">
     <span className="chip">{sourceLabel[item.source]??item.source}</span>
     <span className="chip">{item.modality}</span>
     <span className="chip">{statusLabel[item.state]??'Revisar fonte'}</span>
     {item.compatible.status==='possivel_impedimento'&&<span className="chip">Possível impedimento</span>}
    </div>
    <h3>{item.title}</h3><p>Código: {item.external_code}</p>
    <p>Revisão declarada: {item.checked_on??'Não informada'} · Data final informada:
     {' '}{item.closes_on??'Não informada'} · Situação municipal: {item.compatible.reason}</p>
    <a href={item.source_url} target="_blank" rel="noopener noreferrer">Conferir no portal de origem</a>
   </article>)}</div>
   {!listed.length&&<p className="muted">Nenhuma referência encontrada com os filtros selecionados.
    A ausência de resultados não significa que não existam fontes de financiamento.</p>}
  </section>
  <p className="note">Fonte das informações: histórico de observações do próprio município, com isolamento de dados.
   Limite de consulta nesta versão: os 200 registros mais recentes.</p>
 </>;
}
