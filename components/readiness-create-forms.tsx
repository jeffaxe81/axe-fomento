'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {BASELINE_CRITERIA} from '@/lib/readiness-policy.mjs';
type Project={id:string;title:string};
type Rubric={key:string;version:number};
async function post(url:string,body:unknown){
 const r=await fetch(url,{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json() as {error?:string;id?:string};
 if(!r.ok)throw Error(data.error||'Falha ao salvar.');return data;
}
export function ReadinessCaseCreate({projects}:{projects:Project[]}){
 const router=useRouter(),[kind,setKind]=useState('idea'),[projectId,setProjectId]=useState('');
 const [title,setTitle]=useState(''),[problem,setProblem]=useState('');
 const [audience,setAudience]=useState(''),[objective,setObjective]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   const data=await post('/api/readiness/cases',{kind,projectId:kind==='documented'?projectId:null,
    title,problem,targetAudience:audience,objective});
   router.push('/avaliador/'+data.id);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Erro inesperado');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Tipo de entrada<select value={kind} onChange={e=>setKind(e.target.value)}>
   <option value="idea">Ideia inicial (ainda sem projeto)</option>
   <option value="documented">Projeto municipal documentado</option>
  </select></label>
  {kind==='documented'&&<label>Projeto vinculado<select required value={projectId}
    onChange={e=>setProjectId(e.target.value)}><option value="">Selecione o projeto</option>
    {projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
  <label className="protocol-full">Título da proposta<input required minLength={6} maxLength={180}
   value={title} onChange={e=>setTitle(e.target.value)}/></label>
  <label className="protocol-full">Problema a resolver<textarea required minLength={20} maxLength={2000}
   value={problem} onChange={e=>setProblem(e.target.value)}/></label>
  <label className="protocol-full">Público beneficiado<textarea required minLength={10} maxLength={1000}
   value={audience} onChange={e=>setAudience(e.target.value)}/></label>
  <label className="protocol-full">Objetivo proposto<textarea required minLength={20} maxLength={2000}
   value={objective} onChange={e=>setObjective(e.target.value)}/></label>
  <button className="btn btn-primary" type="submit" disabled={busy||
   (kind==='documented'&&!projectId)}>{busy?'Gravando…':'Cadastrar entrada preliminar'}</button>
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
 </form>;
}
export function ReadinessRubricCreate({rubrics}:{rubrics:Rubric[]}){
 const router=useRouter(),[key,setKey]=useState('municipal_base');
 const [note,setNote]=useState('Criação ou revisão de rubrica institucional de triagem.');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const current=rubrics.find(r=>r.key===key)?.version??0;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess('');
  try{
   const r=await post('/api/readiness/rubrics',{rubricKey:key,expectedVersion:current,
    criteria:BASELINE_CRITERIA,changeNote:note});
   setSuccess('Rubrica registrada na versão '+(r as {version?:number}).version);
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha');}finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Identificador da rubrica<input required minLength={4} maxLength={40}
   pattern="[a-z][a-z0-9_-]{3,39}" value={key} onChange={e=>setKey(e.target.value)}/></label>
  <label>Próxima versão<input readOnly value={current+1}/></label>
  <p className="protocol-full">Rubrica-base: {BASELINE_CRITERIA.map(c=>c.label+' ('+c.weight+'%)').join(' · ')}.</p>
  <label className="protocol-full">Justificativa da versão<textarea required minLength={10} maxLength={500}
   value={note} onChange={e=>setNote(e.target.value)}/></label>
  <button className="btn btn-primary" type="submit" disabled={busy}>
   {busy?'Gravando…':'Registrar rubrica versionada'}</button>
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
  {success&&<p role="status" className="success protocol-full">{success}</p>}
 </form>;
}
