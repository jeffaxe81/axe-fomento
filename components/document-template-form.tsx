'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';
const MODALITIES=[
 ['convenio','Convênio'],['transferencia','Transferência'],['financiamento','Financiamento'],
 ['cooperacao','Cooperação'],['outra','Outra modalidade'],
];
export function DocumentTemplateForm(){
 const router=useRouter();
 const [modality,setModality]=useState('convenio');
 const [title,setTitle]=useState(''),[guidance,setGuidance]=useState('');
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setFailed(false);setMessage('');
  try{
   const response=await fetch('/api/document-templates',{method:'POST',
     headers:{'content-type':'application/json'},credentials:'same-origin',
     body:JSON.stringify({modality,title,guidance})});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Não foi possível cadastrar documento-modelo.');
   setTitle('');setGuidance('');setMessage('Modelo cadastrado. Será aplicado apenas em novos checklists dessa modalidade.');
   router.refresh();
  }catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Erro no cadastro.');}
  finally{setBusy(false);}
 }
 return <section className="panel document-setup" aria-labelledby="template-heading">
  <h2 id="template-heading">Cadastro municipal de documentos-modelo</h2>
  <p className="help">Administrador: crie os documentos que a equipe identificou na modalidade.
    A lista é administrativa, não representa exigência automaticamente extraída ou validada do edital.</p>
  <form className="document-form" onSubmit={(event)=>void submit(event)}>
   <label>Modalidade
    <select value={modality} onChange={(e)=>setModality(e.target.value)}>
     {MODALITIES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
   </label>
   <label>Documento esperado
    <input required minLength={5} maxLength={180} value={title}
      onChange={(e)=>setTitle(e.target.value)} placeholder="Ex.: comprovação documental definida pela equipe"/>
   </label>
   <label>Orientações internas (opcional)
    <textarea rows={2} maxLength={600} value={guidance}
      onChange={(e)=>setGuidance(e.target.value)}
      placeholder="Indique a versão e a referência documental que orientam a equipe." />
   </label>
   <button className="btn btn-primary" disabled={busy} type="submit">{busy?'Salvando…':'Cadastrar modelo'}</button>
   {message&&<p role={failed?'alert':'status'} className={failed?'error':'success'}>{message}</p>}
  </form>
 </section>;
}
