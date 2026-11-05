'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';
const MODALITIES=[
 ['convenio','Convênio'],['transferencia','Transferência'],['financiamento','Financiamento'],
 ['cooperacao','Cooperação'],['outra','Outra modalidade'],
];
export function DocumentChecklistStart({projectId,available}:{
 projectId:string;available:{modality:string;total:number}[];
}){
 const router=useRouter();
 const [modality,setModality]=useState('convenio');
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[message,setMessage]=useState('');
 const n=available.find(x=>x.modality===modality)?.total??0;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setFailed(false);setMessage('');
  try{
   const response=await fetch('/api/projects/document-checklist',{method:'POST',
     headers:{'content-type':'application/json'},credentials:'same-origin',
     body:JSON.stringify({projectId,modality})});
   const result=await response.json() as {error?:string;itemsAdded?:number};
   if(!response.ok)throw new Error(result.error||'Não foi possível gerar checklist.');
   setMessage('Checklist iniciado com '+String(result.itemsAdded??0)+' itens. Os modelos foram copiados para este projeto.');
   router.refresh();
  }catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Falha na operação.');}
  finally{setBusy(false);}
 }
 return <section className="panel document-setup">
  <h2>Iniciar checklist do projeto</h2>
  <p className="help">Selecione uma modalidade revisada pela equipe. O sistema faz uma cópia dos
    documentos-modelo já cadastrados; mudanças futuras nos modelos não alteram este checklist.</p>
  <form className="document-form" onSubmit={(event)=>void submit(event)}>
   <label>Modalidade do projeto
    <select value={modality} onChange={(e)=>setModality(e.target.value)}>
     {MODALITIES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
   </label>
   <p className="help">{n} documento(s) cadastrado(s) nesta modalidade.</p>
   <button type="submit" className="btn btn-primary" disabled={busy||n===0}>
    {busy?'Criando…':'Criar checklist documental'}
   </button>
   {n===0&&<p className="help">Cadastre ao menos um documento-modelo para habilitar esta modalidade.</p>}
   {message&&<p role={failed?'alert':'status'} className={failed?'error':'success'}>{message}</p>}
  </form>
 </section>;
}
