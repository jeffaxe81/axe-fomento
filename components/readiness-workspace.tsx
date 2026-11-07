'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
type Criterion={id:string;label:string;weight:number};
type Idea={id:string;version:number;problem:string;audience:string;objective:string};
type Rubric={id:string;version:number;criteria:Criterion[];note:string};
type Evidence={id:string;kind:string;title:string;snapshot_sha256:string};
type Source={id:string;title:string};
type Assessment={id:string;version:number;stage:string;created_by:string;rubric_id:string;
 criteria_input:Array<{id:string;score:number|null;evidence:string|null}>;
 result_snapshot:{score:number;maximumPossibleScore:number;evaluatedWeight:number;
  breakdown:Array<{id:string;label:string;score:number|null;evidence:string|null;weight:number}>};
 actions:Array<{key:string;title:string;priority:string;reason:string}>};
type Member={id:string;full_name:string};
type Review={assessment_id:string;revision:number};
type Assignment={assessment_id:string;action_key:string;revision:number};
type Props={
 projectId:string;admin:boolean;actorId:string;
 ideas:Idea[];rubrics:Rubric[];evidence:Evidence[];
 documents:Source[];budgets:Source[];assessments:Assessment[];
 assignments:Assignment[];reviews:Review[];members:Member[]
};
const defaultCriteria:Criterion[]=[
 {id:'necessidade',label:'Diagnóstico da demanda municipal',weight:30},
 {id:'impacto',label:'Resultados esperados e impacto',weight:25},
 {id:'orcamento',label:'Orçamento e sustentabilidade',weight:25},
 {id:'governanca',label:'Governança, prazos e riscos',weight:20}
];
export function ReadinessWorkspace({projectId,admin,actorId,ideas,rubrics,evidence,
 documents,budgets,assessments,assignments,reviews,members}:Props){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const [rubricId,setRubricId]=useState(rubrics[0]?.id??'');
 const [stage,setStage]=useState<'idea'|'documented'>('idea');
 const [simulated,setSimulated]=useState<{current:{score:number};hypothetical:{score:number};delta:number}|null>(null);
 const rubric=rubrics.find(x=>x.id===rubricId);
 async function send(payload:unknown,simulation=false){
  if(busy)return;
  setBusy(true);setFeedback('');if(simulation)setSimulated(null);
  try{
   const response=await fetch('/api/projects/readiness',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify(payload)
   });
   const result=await response.json() as {error?:string;version?:number;id?:string;
    current?:{score:number};hypothetical?:{score:number};delta?:number};
   if(!response.ok)throw Error(result.error||'Registro não concluído.');
   if(simulation&&result.current&&result.hypothetical&&typeof result.delta==='number')
    setSimulated({current:result.current,hypothetical:result.hypothetical,delta:result.delta});
   else router.refresh();
   setFeedback(simulation?'Simulação calculada, sem alteração da avaliação original.':
    'Registro gravado com rastreabilidade. Atualize os campos, se necessário.');
  }catch(e){setFeedback(e instanceof Error?e.message:'Falha inesperada.');}
  finally{setBusy(false);}
 }
 const f=(event:FormEvent<HTMLFormElement>)=>new FormData(event.currentTarget);
 const value=(data:FormData,key:string)=>String(data.get(key)??'').trim();
 const latest=assessments[0]??null;
 const reviewable=assessments.filter(a=>a.created_by!==actorId);
 return <section className="panel">
  <h2>Área de trabalho do avaliador</h2>
  <p className="note">Operações acessíveis somente na fase experimental; decisões e evidências são
   declarações humanas. As versões históricas não são sobrescritas.</p>
  {feedback&&<p role="status" className="note">{feedback}</p>}
  <div className="review-events">
   <article className="review-event">
    <h3>1. Registrar ou revisar ideia inicial (AF-042)</h3>
    <form className="external-protocol-form" onSubmit={e=>{e.preventDefault();const d=f(e);
     void send({action:'idea',projectId,expectedVersion:ideas[0]?.version??0,
      problem:value(d,'problem'),audience:value(d,'audience'),objective:value(d,'objective')});}}>
     <label className="protocol-full">Problema público
      <textarea required name="problem" minLength={20} maxLength={2000} rows={3}
       placeholder="Descreva a necessidade pública e seu contexto."/></label>
     <label className="protocol-full">Público beneficiado
      <textarea required name="audience" minLength={10} maxLength={1000} rows={2}
       placeholder="Identifique os usuários e beneficiários previstos."/></label>
     <label className="protocol-full">Objetivo
      <textarea required name="objective" minLength={20} maxLength={2000} rows={3}
       placeholder="Qual transformação o projeto pretende produzir?"/></label>
     <button disabled={busy} className="btn btn-primary" type="submit">Salvar nova versão da ideia</button>
    </form>
    {ideas.length>0&&<p className="help">Versões anteriores: {ideas.map(a=>'v'+a.version).join(' · ')}</p>}
   </article>
   {admin&&<article className="review-event">
    <h3>2. Criar nova rubrica ponderada (AF-044)</h3>
    <p>Critérios com IDs únicos, pesos inteiros positivos que somam 100. Rubricas
     antigas continuam disponíveis nas avaliações já registradas.</p>
    <form className="external-protocol-form" onSubmit={e=>{e.preventDefault();const d=f(e);
     try{void send({action:'rubric',expectedVersion:rubrics[0]?.version??0,
      criteria:JSON.parse(value(d,'criteria')),note:value(d,'note')});}
     catch{setFeedback('JSON de critérios inválido.');}}}>
     <label className="protocol-full">Critérios e pesos (formato JSON)
      <textarea name="criteria" rows={9} required
       defaultValue={JSON.stringify(rubrics[0]?.criteria??defaultCriteria,null,2)}/></label>
     <label className="protocol-full">Justificativa da versão
      <textarea name="note" required minLength={10} maxLength={500} rows={2}
       placeholder="Explique as mudanças na ponderação."/></label>
     <button disabled={busy} className="btn btn-primary" type="submit">Versionar rubrica</button>
    </form>
   </article>}
   <article className="review-event">
    <h3>3. Vincular evidência técnica ou financeira (AF-043)</h3>
    <p>O vínculo utiliza a versão exata do documento ou um item orçamentário imutável.
     Evidências permanecem privadas ao município.</p>
    <form className="external-protocol-form" onSubmit={e=>{e.preventDefault();const d=f(e);
     const parts=value(d,'source').split(':');if(parts.length!==2)return;
     void send({action:'evidence',projectId,kind:parts[0],sourceId:parts[1],
      note:value(d,'note')});}}>
     <label className="protocol-full">Fonte vinculada
      <select name="source" required defaultValue="">
       <option value="" disabled>Selecione versão de documento ou item financeiro</option>
       {documents.map(d=><option key={'document:'+d.id} value={'document:'+d.id}>Documento: {d.title}</option>)}
       {budgets.map(d=><option key={'budget:'+d.id} value={'budget:'+d.id}>Orçamento: {d.title}</option>)}
      </select></label>
     <label className="protocol-full">Justificativa e referência
      <textarea name="note" rows={2} required minLength={10} maxLength={1000}/></label>
     <button disabled={busy||(!documents.length&&!budgets.length)} className="btn btn-primary"
      type="submit">Vincular evidência versionada</button>
    </form>
    {!evidence.length?<p className="help">Nenhuma evidência vinculada.</p>:
     <ul>{evidence.map(x=><li key={x.id}>{x.kind==='document'?'Documento':'Orçamento'}: {x.title}
      {' '}· SHA-256 <code>{x.snapshot_sha256}</code></li>)}</ul>}
   </article>
   <article className="review-event">
    <h3>4. Registrar avaliação de prontidão (AF-045 a AF-047 e AF-049)</h3>
    <form className="external-protocol-form" onSubmit={e=>{e.preventDefault();const d=f(e);
     if(!rubric)return setFeedback('Cadastre uma rubrica para avaliar.');
     const scores=rubric.criteria.map(c=>{
      const raw=value(d,'score:'+c.id);
      return {id:c.id,score:raw===''?null:Number(raw),
       evidence:raw===''?null:value(d,'evidence:'+c.id)};
     });
     try{
      const blockers=JSON.parse(value(d,'blockers'));
      void send({action:'evaluate',projectId,stage,ideaId:ideas[0]?.id??null,
       rubricId:rubric.id,previousId:latest?.id??null,
       expectedVersion:latest?.version??0,assessments:scores,blockers,note:value(d,'note')});
     }catch{setFeedback('JSON de impedimentos inválido.');}
    }}>
     <label>Estágio
      <select value={stage} onChange={e=>setStage(e.target.value as 'idea'|'documented')}>
       <option value="idea">Ideia inicial</option>
       <option value="documented">Projeto documentado (exige provas técnica e financeira)</option>
      </select></label>
     <label>Rubrica
      <select value={rubricId} onChange={e=>setRubricId(e.target.value)}>
       {rubrics.map(r=><option key={r.id} value={r.id}>Versão {r.version} · {r.criteria.length} critérios</option>)}
      </select></label>
     {!rubrics.length&&<p className="note">É necessário criar uma rubrica primeiro.</p>}
     {stage==='idea'&&!ideas.length&&<p className="note">É necessário registrar uma ideia antes da pontuação inicial.</p>}
     {rubric?.criteria.map(c=><div key={c.id} className="protocol-full">
      <h4>{c.label} · peso {c.weight}%</h4>
      <label>Pontuação informada (0 a 100; em branco = pendente)
       <input name={'score:'+c.id} type="number" min="0" max="100"/></label>
      <label>Evidência para a pontuação
       <textarea name={'evidence:'+c.id} rows={2} maxLength={2000}
        placeholder="Informe a fonte e premissas da nota atribuída."/></label>
     </div>)}
     <label className="protocol-full">Impedimentos documentados (JSON; confirmação humana)
      <textarea name="blockers" rows={3} defaultValue="[]"
       placeholder={'[{"id":"item","title":"Regra impeditiva","ruleUrl":"https://...","evidence":"Documento e trecho","confirmed":true}]'}/></label>
     <label className="protocol-full">Nota e premissas da avaliação
      <textarea name="note" required minLength={10} maxLength={1000} rows={2}/></label>
     <button disabled={busy||!rubric||(stage==='idea'&&!ideas.length)}
      className="btn btn-primary" type="submit">Registrar avaliação imutável</button>
    </form>
   </article>
   {latest&&<article className="review-event">
    <h3>5. Simular melhoria sem sobrescrever a nota (AF-048)</h3>
    <p>Nota registrada: {latest.result_snapshot.score}. Simulações são hipóteses,
     não pareceres e não alteram as avaliações ou impedimentos.</p>
    <form className="external-protocol-form" onSubmit={e=>{e.preventDefault();const d=f(e);
     const changes=latest.result_snapshot.breakdown.filter(c=>value(d,'sim:'+c.id)!=='')
      .map(c=>({id:c.id,score:Number(value(d,'sim:'+c.id)),
       evidence:value(d,'reason:'+c.id)}));
     void send({action:'simulate',assessmentId:latest.id,changes},true);
    }}>
     {latest.result_snapshot.breakdown.map(c=><div key={c.id} className="protocol-full">
      <label>{c.label} — nota hipotética (atual {c.score??'pendente'})
       <input type="number" min="0" max="100" name={'sim:'+c.id}/></label>
      <label>Premissa para a melhoria
       <input type="text" name={'reason:'+c.id} placeholder="Fonte da hipótese de melhoria"/></label>
     </div>)}
     <button disabled={busy} className="btn btn-outline" type="submit">Simular nova pontuação</button>
    </form>
    {simulated&&<p role="status"><strong>Nota registrada:</strong> {simulated.current.score}
     {' '}· <strong>Nota hipotética:</strong> {simulated.hypothetical.score}
     {' '}· <strong>Diferença:</strong> {simulated.delta} pontos.</p>}
   </article>}
   {latest&&latest.actions.length>0&&<article className="review-event">
    <h3>6. Atribuir responsável a ação de correção (AF-047)</h3>
    <form className="external-protocol-form" onSubmit={e=>{e.preventDefault();const d=f(e);
     const actionKey=value(d,'actionKey');
     const previous=assignments.filter(a=>a.assessment_id===latest.id&&a.action_key===actionKey)
      .reduce((m,a)=>Math.max(m,a.revision),0);
     void send({action:'assign',assessmentId:latest.id,actionKey,
      expectedRevision:previous,assignedTo:value(d,'person')||null,note:value(d,'note')});}}>
     <label className="protocol-full">Ação
      <select name="actionKey">{latest.actions.map(a=>
       <option key={a.key} value={a.key}>{a.title} · {a.priority}</option>)}</select></label>
     <label>Responsável ativo da prefeitura
      <select name="person"><option value="">Sem responsável</option>
       {members.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
     <label className="protocol-full">Justificativa
      <textarea name="note" required minLength={10} maxLength={500} rows={2}/></label>
     <button disabled={busy} className="btn btn-primary" type="submit">Registrar atribuição</button>
    </form>
   </article>}
   {admin&&reviewable.length>0&&<article className="review-event">
    <h3>7. Revisão independente e reavaliação (AF-049)</h3>
    <form className="external-protocol-form" onSubmit={e=>{e.preventDefault();const d=f(e);
     const assessmentId=value(d,'assessmentId');
     const previous=reviews.filter(r=>r.assessment_id===assessmentId)
      .reduce((m,r)=>Math.max(m,r.revision),0);
     void send({action:'review',assessmentId,expectedRevision:previous,
      decision:value(d,'decision'),note:value(d,'note')});}}>
     <label>Avaliação
      <select name="assessmentId">{reviewable.map(a=>
       <option key={a.id} value={a.id}>Versão {a.version} · {a.stage}</option>)}</select></label>
     <label>Decisão
      <select name="decision"><option value="reviewed">Conferida internamente</option>
       <option value="needs_changes">Devolvida para ajustes</option></select></label>
     <label className="protocol-full">Justificativa do revisor
      <textarea name="note" required minLength={15} maxLength={1000} rows={2}/></label>
     <button disabled={busy} className="btn btn-primary" type="submit">Registrar revisão independente</button>
    </form>
   </article>}
  </div>
 </section>;
}
