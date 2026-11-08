'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';
import {SECTION_LABELS,type ProposalSections} from '@/lib/proposal-draft.mjs';

export function ProposalCreateForm({projectId}:{projectId:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(){
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/projects/proposals',{method:'POST',
    credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId})});
   const body=await response.json() as {error?:string};
   if(!response.ok)throw new Error(body.error||'Não foi possível iniciar o rascunho.');
   setMessage('Rascunho criado com pendências explícitas. Confira e edite as seções.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao iniciar o rascunho.');}
  finally{setBusy(false);}
 }
 return <div>
  <p>O modelo será preenchido apenas com informações declaradas no cadastro municipal.
   Campos sem evidência serão marcados como pendentes.</p>
  <button type="button" className="btn btn-primary" disabled={busy}
   onClick={()=>void submit()}>{busy?'Preparando…':'Criar rascunho inicial'}</button>
  {message&&<p role="status" className="success">{message}</p>}
  {error&&<p role="alert" className="error">{error}</p>}
 </div>;
}
export function ProposalRevisionForm({projectId,draftId,version,sections}:{
 projectId:string;draftId:string;version:number;sections:ProposalSections
}){
 const router=useRouter();
 const [current,setCurrent]=useState<ProposalSections>(sections);
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');setError('');
  try{
   const response=await fetch('/api/projects/proposals/revisions',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({
     projectId,draftId,expectedVersion:version,sections:current,revisionNote:note
    })
   });
   const body=await response.json() as {error?:string;version?:number};
   if(!response.ok)throw new Error(body.error||'Não foi possível gravar a versão.');
   setNote('');setMessage('Nova versão registrada com histórico preservado.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Erro ao salvar.');}
  finally{setBusy(false);}
 }
 const text=SECTION_LABELS.map(([key,label])=>label+'\n'+current[key as keyof ProposalSections])
  .join('\n\n');
 return <form onSubmit={e=>void submit(e)} className="external-protocol-form">
  {SECTION_LABELS.map(([key,label])=><label className="protocol-full" key={key}>
   {label}<textarea required rows={7} minLength={10} maxLength={4000}
    value={current[key as keyof ProposalSections]} onChange={e=>
     setCurrent(before=>({...before,[key]:e.target.value}))}/>
   </label>)}
  <label className="protocol-full">Motivo desta revisão
   <textarea required rows={2} minLength={10} maxLength={500} value={note}
    onChange={e=>setNote(e.target.value)}
    placeholder="Resuma quais informações foram conferidas ou complementadas."/>
  </label>
  <div className="radar-actions protocol-full">
   <button className="btn btn-primary" type="submit" disabled={busy||note.trim().length<10}>
    {busy?'Gravando…':'Salvar nova versão'}</button>
   <button className="btn btn-outline" type="button" onClick={()=>{
    void navigator.clipboard.writeText(text).then(
     ()=>{setMessage('Texto do rascunho copiado.');setError('');},
     ()=>setError('Não foi possível copiar; selecione o texto das seções.')
    );
   }}>Copiar texto do rascunho</button>
  </div>
  <p className="help protocol-full">Edição não confirma a autenticidade das fontes nem remove
   pendências de origem. Cada salvamento cria nova versão auditável, sem sobrescrever a anterior.</p>
  {message&&<p role="status" className="success protocol-full">{message}</p>}
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
 </form>;
}
