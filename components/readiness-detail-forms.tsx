'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {BLOCKER_RULES,calculateReadiness} from '@/lib/readiness-policy.mjs';
export type Criterion={id:string;label:string;weight:number};
export type Rubric={id:string;rubric_key:string;version:number;criteria:Criterion[]};
export type UserChoice={id:string;full_name:string};
export type EvidenceChoice={id:string;item_title:string;file_name:string;version:number};
export type ScoreRow={id:string;score:number|null;evidence:string|null};
export type Blocker={code:string;rule:string;evidence:string};
type Action={id:string;priority:string;reason:string;recommendation:string;impact:number};
async function post(url:string,body:unknown){
 const response=await fetch(url,{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const payload=await response.json() as {error?:string;id?:string;revision?:number};
 if(!response.ok)throw Error(payload.error||'Não foi possível gravar.');
 return payload;
}
export function ReadinessEvidenceLink({caseId,versions}:{caseId:string;versions:EvidenceChoice[]}){
 const router=useRouter(),[versionId,setVersionId]=useState('');
 const [note,setNote]=useState('Versão informada como evidência para a triagem interna.');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{await post('/api/readiness/evidence',{caseId,versionId,note});
   setVersionId('');router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha');}finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label className="protocol-full">Versão exata do anexo<select required value={versionId}
   onChange={e=>setVersionId(e.target.value)}><option value="">Selecione arquivo/versionamento</option>
   {versions.map(v=><option key={v.id} value={v.id}>{v.item_title} · v{v.version} · {v.file_name}</option>)}
  </select></label>
  <label className="protocol-full">Nota da evidência<textarea required minLength={10} maxLength={500}
   value={note} onChange={e=>setNote(e.target.value)}/></label>
  <button className="btn btn-primary" type="submit" disabled={busy||!versionId}>
   {busy?'Vinculando…':'Vincular versão ao avaliador'}</button>
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
 </form>;
}
export function ReadinessAssessmentCreate({caseId,rubrics,expectedRevision}:{
 caseId:string;rubrics:Rubric[];expectedRevision:number
}){
 const router=useRouter(),[rubricId,setRubricId]=useState(rubrics[0]?.id??'');
 const [draft,setDraft]=useState<Record<string,{score:string;evidence:string}>>({});
 const [blocks,setBlocks]=useState<Record<string,{selected:boolean;evidence:string}>>({});
 const [revisionNote,setRevisionNote]=useState('Revisão interna de maturidade com evidências declaradas.');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const rubric=rubrics.find(r=>r.id===rubricId);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!rubric)return;setBusy(true);setError('');setSuccess('');
  const answers=rubric.criteria.map(x=>{
   const item=draft[x.id],s=item?.score??'';
   return {id:x.id,score:s===''?null:Number(s),evidence:item?.evidence?.trim()||undefined};
  });
  const blockers=BLOCKER_RULES.filter(x=>blocks[x.code]?.selected)
   .map(x=>({code:x.code,evidence:blocks[x.code]?.evidence?.trim()??''}));
  try{
   const res=await post('/api/readiness/assessments',{caseId,rubricId,
    expectedRevision,answers,blockers,revisionNote});
   setSuccess('Avaliação v'+res.revision+' registrada; parecer indicativo, não oficial.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha');}finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label className="protocol-full">Rubrica e versão<select required value={rubricId}
   onChange={e=>setRubricId(e.target.value)}>
   {rubrics.map(r=><option key={r.id} value={r.id}>{r.rubric_key} · v{r.version}</option>)}
  </select></label>
  {rubric?.criteria.map(c=>{
   const v=draft[c.id]??{score:'',evidence:''};
   return <div className="protocol-full" key={c.id}>
    <h3>{c.label} · peso {c.weight}%</h3>
    <label>Nota declarada (0 a 100; deixe em branco se não houver evidência)
     <input type="number" min={0} max={100} step={1} value={v.score}
      onChange={e=>setDraft(s=>({...s,[c.id]:{...v,score:e.target.value}}))}/></label>
    <label>Evidência e fonte (obrigatória para nota informada)
     <textarea maxLength={2000} value={v.evidence}
      onChange={e=>setDraft(s=>({...s,[c.id]:{...v,evidence:e.target.value}}))}/></label>
   </div>;
  })}
  <div className="protocol-full"><h3>Impedimentos declarados (independentes da nota)</h3>
   <p>Marque apenas quando houver regra ou evidência humana para conferir.</p>
   {BLOCKER_RULES.map(rule=><div key={rule.code}>
    <label><input type="checkbox" checked={blocks[rule.code]?.selected??false}
     onChange={e=>setBlocks(s=>({...s,[rule.code]:{
      selected:e.target.checked,evidence:s[rule.code]?.evidence??''
     }}))}/> {rule.label}</label>
    {blocks[rule.code]?.selected&&<label>Fundamento ou evidência específica
     <textarea required minLength={15} maxLength={1000}
      value={blocks[rule.code]?.evidence??''}
      onChange={e=>setBlocks(s=>({...s,[rule.code]:{
       selected:true,evidence:e.target.value
      }}))}/></label>}
   </div>)}
  </div>
  <label className="protocol-full">Justificativa da avaliação/reavaliação
   <textarea required minLength={15} maxLength={500} value={revisionNote}
    onChange={e=>setRevisionNote(e.target.value)}/></label>
  <button className="btn btn-primary" disabled={busy||!rubric} type="submit">
   {busy?'Registrando…':'Registrar avaliação v'+(expectedRevision+1)}</button>
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
  {success&&<p role="status" className="success protocol-full">{success}</p>}
 </form>;
}
export function ReadinessReviewForm({assessmentId,expectedRevision}:{
 assessmentId:string;expectedRevision:number
}){
 const router=useRouter(),[decision,setDecision]=useState('devolvida'),
 [note,setNote]=useState('Necessário conferir as evidências e corrigir pendências antes de nova avaliação.');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{await post('/api/readiness/reviews',{assessmentId,expectedRevision,decision,note});
   router.refresh();}catch(e){setError(e instanceof Error?e.message:'Falha');}finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Decisão editorial interna<select value={decision} onChange={e=>setDecision(e.target.value)}>
   <option value="devolvida">Devolver para complementação</option>
   <option value="revisada">Conferida internamente</option></select></label>
  <label className="protocol-full">Justificativa detalhada<textarea required minLength={20} maxLength={1000}
   value={note} onChange={e=>setNote(e.target.value)}/></label>
  <button type="submit" className="btn btn-primary" disabled={busy}>
   {busy?'Gravando…':'Registrar decisão (versão '+(expectedRevision+1)+')'}</button>
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
 </form>;
}
export function ReadinessActionAssign({assessmentId,actionCode,users,expectedRevision}:{
 assessmentId:string;actionCode:string;users:UserChoice[];expectedRevision:number
}){
 const router=useRouter(),[userId,setUserId]=useState(''),
 [justification,setJustification]=useState('Responsável designado pela equipe municipal para verificar esta pendência.');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{await post('/api/readiness/actions/assign',{assessmentId,actionCode,
   responsibleUserId:userId,expectedRevision,justification});
   router.refresh();}catch(e){setError(e instanceof Error?e.message:'Falha');}finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Responsável<select required value={userId} onChange={e=>setUserId(e.target.value)}>
   <option value="">Selecione o servidor municipal</option>
   {users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
  </select></label>
  <label className="protocol-full">Justificativa<textarea required minLength={10} maxLength={500}
   value={justification} onChange={e=>setJustification(e.target.value)}/></label>
  <button className="btn btn-outline" type="submit" disabled={busy||!userId}>
   {busy?'Atribuindo…':'Atribuir responsável'}</button>
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
 </form>;
}
export function ReadinessSimulator({rubric,scores,blockers,originalScore}:{
 rubric:Criterion[];scores:ScoreRow[];blockers:Blocker[];originalScore:number
}){
 const [draft,setDraft]=useState<Record<string,string>>({});
 const projected=rubric.map(c=>{
  const saved=scores.find(x=>x.id===c.id);
  const score=draft[c.id]===undefined?saved?.score??null:
   draft[c.id]===''?null:Number(draft[c.id]);
  return {id:c.id,score,evidence:score===null?undefined:
   draft[c.id]===undefined?saved?.evidence??'Hipótese sem evidência':
   'Hipótese simulada, ainda sem comprovação documental'};
 });
 let estimate:ReturnType<typeof calculateReadiness>|null=null;
 try{estimate=calculateReadiness(rubric,projected,blockers);}catch{}
 return <div>
  <p className="note">AF-048 · Simulação local: as notas projetadas não são gravadas e
   não removem impedimentos declarados. Qualquer melhoria precisa ser documentada
   e validada em nova avaliação.</p>
  <div className="external-protocol-form">
   {rubric.map(c=><label key={c.id}>{c.label} ({c.weight}%)
    <input type="number" min={0} max={100} step={1}
     value={draft[c.id]??scores.find(x=>x.id===c.id)?.score??''}
     onChange={e=>setDraft(s=>({...s,[c.id]:e.target.value}))}/>
   </label>)}
  </div>
  <p><strong>Nota registrada: {originalScore.toFixed(2)}/100</strong></p>
  {estimate&&<p><strong>Nota simulada: {estimate.score.toFixed(2)}/100</strong>
   {' '}· máximo possível com lacunas: {estimate.maximumPossibleScore.toFixed(2)}/100
   {' '}· {estimate.blockers.length} impedimento(s) permanecem.</p>}
  <button className="btn btn-outline" type="button" onClick={()=>setDraft({})}>
   Limpar hipóteses</button>
 </div>;
}
