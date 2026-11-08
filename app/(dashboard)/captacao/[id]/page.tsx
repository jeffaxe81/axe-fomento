import Link from 'next/link';
import {radarReferenceDate} from '@/lib/opportunity-deadline.mjs';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {classifyObservation,checkDossier,handoffFor,fundingEligibilityForCase} from '@/lib/funding-pipeline.mjs';
import {FundingCaseEventForm,FundingSimulationForm} from '@/components/funding-forms';
export const dynamic='force-dynamic';
type Case={id:string;project_id:string;project_title:string;source:string;
 offer_title:string;source_url:string;observation_kind:string;reference_status:string;is_superseded:boolean;
 checked_on:string|null;opens_on:string|null;closes_on:string|null;modality:string;
 terms:{documentation?:string[];requiresGuarantee?:boolean;minimumPopulation?:number}};
type Event={id:string;revision:number;event_kind:string;note:string;
 evidence_url:string|null;event_date:string|null;value_cents:string|null;
 fingerprint:string;created_at:string};
type Doc={id:string;title:string;status:string;version_id:string|null};
const labels:Record<string,string>={
 eligibility:'AF-056 — Elegibilidade',line_comparison:'AF-057 — Comparação',
 financial_simulation:'AF-058 — Simulação',documentation_check:'AF-059 — Documentação',
 dossier:'AF-060 — Dossiê',submission_handoff:'AF-061 — Encaminhamento',
 protocol_update:'AF-062 — Protocolo',diligence_alert:'AF-063 — Diligência',
 award_verification:'AF-064 — Aprovação declarada',
 disbursement_verification:'AF-064 — Desembolso declarado',decision_review:'AF-065 — Revisão de resultados'
};
const money=(cents:string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
 .format(Number(cents)/100);
export default async function FundingCasePage({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession();const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [record]=await queryForMunicipality<Case>(actor.municipality_id,
  'SELECT c.id,c.project_id,p.title AS project_title,o.source,o.title AS offer_title,o.source_url,'+
  'o.observation_kind,o.reference_status,'+
  'EXISTS(SELECT 1 FROM funding_observations newer WHERE newer.municipality_id=o.municipality_id '+
  'AND newer.source=o.source AND newer.external_code=o.external_code '+
  'AND (newer.created_at,newer.id)>(o.created_at,o.id)) AS is_superseded,'+
  'o.checked_on::text AS checked_on,'+
  'o.opens_on::text AS opens_on,o.closes_on::text AS closes_on,o.modality,o.terms '+
  'FROM funding_cases c JOIN projects p ON p.id=c.project_id AND p.municipality_id=c.municipality_id '+
  'JOIN funding_observations o ON o.id=c.observation_id AND o.municipality_id=c.municipality_id '+
  'WHERE c.municipality_id=$1 AND c.id=$2',[actor.municipality_id,id],actor.id);
 if(!record)notFound();
 const [events,documents,[municipality],[capag]]=await Promise.all([
  queryForMunicipality<Event>(actor.municipality_id,
   'SELECT id,revision,event_kind,note,evidence_url,event_date::text AS event_date,'+
   'value_cents::text AS value_cents,fingerprint,created_at FROM funding_case_events '+
   'WHERE municipality_id=$1 AND case_id=$2 ORDER BY revision DESC LIMIT 100',
   [actor.municipality_id,id],actor.id),
  queryForMunicipality<Doc>(actor.municipality_id,
   'SELECT d.id,d.title,d.status,('+
   'SELECT v.id::text FROM project_document_versions v WHERE v.item_id=d.id '+
   'AND v.project_id=$2 AND v.municipality_id=$1 ORDER BY v.version DESC LIMIT 1) AS version_id '+
   'FROM project_document_items d WHERE d.municipality_id=$1 AND d.project_id=$2 '+
   'ORDER BY d.title LIMIT 100',[actor.municipality_id,record.project_id],actor.id),
  queryForMunicipality<{population:number|null}>(actor.municipality_id,
   'SELECT population FROM municipalities WHERE id=$1',[actor.municipality_id],actor.id),
  queryForMunicipality<{classification:string;reference_date:string}>(actor.municipality_id,
   'SELECT classification,reference_date::text AS reference_date FROM municipal_capag '+
   'WHERE municipality_id=$1',[actor.municipality_id],actor.id)
 ]);
 const normalizedDocs=documents.map(d=>({title:d.title,status:d.status,versionId:d.version_id}));
 const dossier=checkDossier(normalizedDocs);
 const fit=fundingEligibilityForCase(record,{population:municipality?.population??null,
  capag:capag?.classification??null},normalizedDocs);
 const handoff=handoffFor(record);
 const today=radarReferenceDate().toISOString().slice(0,10);
 const overdue=events.filter(e=>e.event_kind==='diligence_alert'&&e.event_date&&e.event_date<=today);
 const enabled=process.env.ENABLE_FUNDING_PIPELINE==='yes';
 return <>
  <div className="section-eyebrow">CAPTAÇÃO MUNICIPAL · JORNADA DOCUMENTAL</div>
  <div className="page-heading"><div><h1>{record.project_title}</h1>
   <p>{record.offer_title} · {record.source}</p></div>
   <div className="radar-actions">
    <Link href="/captacao" className="btn btn-outline">Voltar à captação</Link>
    <Link href={'/projetos/'+record.project_id} className="btn btn-outline">Projeto</Link>
    <a href={'/api/funding/dossier/'+id} className="btn btn-primary">Exportar dossiê PDF interno</a>
   </div></div>
  <section className="panel">
   <h2>Fonte, modalidade e validade</h2>
   {record.is_superseded&&<p role="alert" className="note"><strong>ATENÇÃO — versão da fonte substituída.</strong> Foi cadastrada uma revisão mais recente desta referência. Esta candidatura permanece como registro histórico, mas a confirmação atual de prazos e requisitos deve ser refeita antes de qualquer encaminhamento.</p>}
   <p>Modalidade {record.modality} · Situação indicativa: <strong>{classifyObservation(record,today)}</strong></p>
   <p>Última conferência informada: {record.checked_on??'Não registrada'}
     · Prazo informado: {record.closes_on??'Não registrado'}</p>
   {handoff.portalUrl?<a href={handoff.portalUrl} target="_blank"
    rel="noopener noreferrer">Consultar portal oficial de referência</a>:
    <p>Referência não habilitada para encaminhamento; revisar URL.</p>}
  </section>
  <section className="panel">
   <h2>AF-056 e AF-059 · Elegibilidade e checklist documental</h2>
   <p><strong>Conclusão: análise humana obrigatória.</strong>
    CAPAG declarada: {capag?.classification??'Não informada'}
    {capag?.reference_date?' (referência '+capag.reference_date+')':''}.
    A nota CAPAG não é prova de elegibilidade final ou garantia da União.</p>
   {fit.signals.map((s:{code:string;state:string;why:string},i:number)=><p key={i}>
    <strong>{s.code} · {s.state}:</strong> {s.why}</p>)}
   <p>Todos os critérios de crédito, capacidade fiscal, garantia, licença e habilitação
    exigem verificação específica com a instituição. Os documentos abaixo provêm
    do checklist municipal preexistente, não de um edital inferido.</p>
   <p><strong>{documents.length} documentos</strong> · {dossier.pending.length} sem versão apresentada
     · Dossiê documental {dossier.ready?'com itens registrados':'incompleto ou sem modelo'}</p>
   <Link href={'/projetos/'+record.project_id+'/documentos'}>Ver checklist e anexos versionados</Link>
   {dossier.pending.slice(0,20).map((n:string,i:number)=><p key={i}>Pendente no checklist: {n}</p>)}
   {fit.documentary.gaps.map((d:{requirement:string},i:number)=><p key={'gap-'+i}>
    Exigência da linha sem evidência válida: {d.requirement}</p>)}
  </section>
  <section className="panel">
   <h2>AF-058 · Simulação financeira hipotética</h2>
   <FundingSimulationForm/>
  </section>
  <section className="panel">
   <h2>AF-060 e AF-061 · Preparação e encaminhamento</h2>
   <ol>{handoff.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
   <p className="help">O relatório PDF é interno. O protocolo deve ser realizado no portal externo
    por representante habilitado, e seu comprovante registrado no AXE.</p>
  </section>
  <section className="panel">
   <h2>AF-062 a AF-065 · Histórico, diligências e resultados</h2>
   {overdue.length>0&&<p role="alert"><strong>{overdue.length} diligência(s) com data vencida
    ou prevista para hoje</strong>. Consulte o sistema do financiador para verificar o prazo efetivo.</p>}
   <div className="review-events">
    {events.map(e=><article key={e.id} className="review-event">
     <div className="small-tags"><span className="chip">Rev. {e.revision}</span>
      <span className="chip">{labels[e.event_kind]??e.event_kind}</span></div>
     <p>{e.note}</p>
     {e.event_date&&<p>Data informada: {e.event_date}</p>}
     {e.value_cents&&<p>Valor informado: {money(e.value_cents)}</p>}
     {e.evidence_url&&<p><a href={e.evidence_url} target="_blank"
      rel="noopener noreferrer">Abrir referência institucional declarada</a></p>}
     <p className="help">SHA-256: {e.fingerprint}</p>
    </article>)}
   </div>
   {!events.length&&<p className="muted">Nenhuma etapa registrada.</p>}
  </section>
  <section className="panel">
   <h2>Registrar etapa de captação</h2>
   <FundingCaseEventForm enabled={enabled} caseId={id} expectedRevision={events[0]?.revision??0}/>
  </section>
 </>;
}
