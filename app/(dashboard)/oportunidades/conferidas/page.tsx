import Link from 'next/link';
import {NoticeReviewForm} from '@/components/notice-review-form';
import {summarizeNoticeReviews} from '@/lib/notice-review-policy.mjs';
import {auditV1NoticeCandidate} from '@/lib/v1-notice-preflight.mjs';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {radarReferenceDate} from '@/lib/opportunity-deadline.mjs';
import {classifyObservation,municipalityOfferCompatibility} from '@/lib/funding-pipeline.mjs';
export const dynamic='force-dynamic';
type Observed={
 id:string;source:string;external_code:string;title:string;source_url:string;
 modality:string;observation_kind:string;reference_status:string;
 opens_on:string|null;closes_on:string|null;checked_on:string|null;created_at:string;created_by:string;
 terms:{minimumPopulation?:number;thematicAreas?:string[];noticeEvidence?:{noticeIdentifier:string;noticeUrl:string;publicationDate:string;issuingAgency:string}};
};
type Review={id:string;observation_id:string;review_state:string;eligibility_state:string;reviewed_by:string;reviewed_on:string;reason:string;created_at:string};
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
const preflightLabels:Record<string,string>={
 documento_individual_pendente:'Documento oficial específico ausente ou incompleto',
 vigencia_nao_comprovada:'Vigência ou prazo sem comprovação documental',
 possivel_impedimento_municipal:'Possível impedimento do município',
 populacao_municipal_nao_informada:'População municipal não informada',
 segunda_revisao_pendente:'Pendente de revisão por segundo administrador',
 elegibilidade_municipal_pendente:'Enquadramento municipal pendente de revisão',
 data_parecer_incoerente:'Data do parecer incompatível com a consulta'
};
const value=(s:string|string[]|undefined)=>typeof s==='string'?s:Array.isArray(s)?s[0]??'':'';
export default async function VerifiedRadar({searchParams}:{searchParams:Promise<Filter>}){
 const actor=await requireSession();
 const filters=await searchParams;
 const term=value(filters.busca).replaceAll('\0','').trim().slice(0,120).toLocaleLowerCase('pt-BR');
 const modality=value(filters.modalidade);
 const situation=value(filters.situacao);
 const [[municipality],observations,reviews]=await Promise.all([
  queryForMunicipality<{name:string;population:number|null;priority_areas:string[]}>(actor.municipality_id,
   'SELECT name,population,priority_areas FROM municipalities WHERE id=$1',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Observed>(actor.municipality_id,
   'SELECT * FROM (SELECT DISTINCT ON (source,external_code) id,source,external_code,title,'+
   'source_url,modality,observation_kind,reference_status,opens_on::text AS opens_on,'+
   'closes_on::text AS closes_on,checked_on::text AS checked_on,created_at,created_by,terms '+
   'FROM funding_observations WHERE municipality_id=$1 '+
   'ORDER BY source,external_code,created_at DESC,id DESC) latest '+
   'ORDER BY created_at DESC,id DESC LIMIT 200',
   [actor.municipality_id],actor.id),
  queryForMunicipality<Review>(actor.municipality_id,
   'SELECT id,observation_id,review_state,eligibility_state,reviewed_by,'+
   'reviewed_on::text AS reviewed_on,reason,created_at FROM funding_notice_reviews '+
   'WHERE municipality_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',
   [actor.municipality_id],actor.id)
 ]);
 const today=radarReferenceDate().toISOString().slice(0,10);
 const all=observations.map(item=>({
  ...item,state:classifyObservation(item,today),
  compatible:municipalityOfferCompatibility(item,municipality)
 }));
 const latestReview=new Map<string,Review>();
 for(const review of reviews){if(!latestReview.has(review.observation_id))latestReview.set(review.observation_id,review);}
 const reviewSummary=summarizeNoticeReviews(reviews);
 const audited=all.map(item=>({...item,
  preflight:auditV1NoticeCandidate(item,municipality,latestReview.get(item.id),today)
 }));
 const reviewable=all.filter(o=>o.state==='potencialmente_aberta_verificar_fonte'&&
  o.created_by!==actor.id&&o.terms?.noticeEvidence?.noticeUrl);
 const current=all.filter(x=>x.state==='potencialmente_aberta_verificar_fonte').length;
 const reviewed=all.filter(x=>x.observation_kind==='oportunidade_conferida'&&
  x.reference_status==='conferida_por_operador').length;
 const listed=audited.filter(o=>(!term||[o.title,o.source,o.external_code].some(t=>t.toLocaleLowerCase('pt-BR').includes(term)))&&
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
   <p className="help">{reviewSummary.observationsWithSecondReview} observações com segundo parecer municipal registrado;
    {reviewSummary.declaredConfirmed} declarações positivas. Não são homologações da autoridade concedente.</p>
   <p className="note"><strong>Atenção:</strong> conferir uma referência não é prova de edital aberto,
    aprovação de crédito ou elegibilidade. O sistema não consultou o processo oficial no momento desta página.
    A classificação depende de informação registrada por usuários municipais.</p>
  </section>
  <section className="panel">
   <h2>Segunda conferência documental do município</h2>
   <p>O parecer deve ser feito por um administrador diferente do autor. Ele registra
    fonte documental, situação do prazo e critérios municipais, mas não garante
    aprovação do programa nem substitui a consulta ao portal público.</p>
   {actor.role==='admin'?<NoticeReviewForm
    enabled={process.env.ENABLE_NOTICE_REVIEW==='yes'}
    options={reviewable.map(o=>({id:o.id,title:o.title,
     documentUrl:o.terms?.noticeEvidence?.noticeUrl??''}))}/>:
    <p className="help">Somente administrador municipal pode registrar o segundo parecer.</p>}
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
    {latestReview.has(item.id)&&<p className="help">Parecer municipal de segundo responsável:
     {' '}{latestReview.get(item.id)?.review_state} · Elegibilidade declarada:
     {' '}{latestReview.get(item.id)?.eligibility_state} · Em:
     {' '}{latestReview.get(item.id)?.reviewed_on}. Sem certificação externa.</p>}
    <p className="help"><strong>Checklist antecipado V1-07:</strong>{' '}
     {item.preflight.documentaryReadyForExternalAudit?
      'Registros municipais prontos para auditoria externa, sem certificação da fonte.':
      'Pendências: '+item.preflight.issues.map((code:string)=>preflightLabels[code]??code).join('; ')}.
     {' '}V1-07 continua dependente de verificação real independente.</p>
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
