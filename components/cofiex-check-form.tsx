'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {COFIEX_STATES} from '@/lib/cofiex-labels.mjs';

export function CofiexCheckForm({projectId,stageCode,expectedRevision,today}:{
 projectId:string;stageCode:string;expectedRevision:number;today:string
}){
 const router=useRouter();
 const [state,setState]=useState('em_preparacao');
 const [date,setDate]=useState(today),[note,setNote]=useState('');
 const [ack,setAck]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/projects/cofiex/checks',{
    method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
     projectId,stageCode,expectedRevision,
     consultationState:state,consultedOn:date,note,
     acknowledgedLimits:ack
    })
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Erro ao salvar consulta interna.');
   setNote('');setAck(false);
   setSuccess('Consulta interna versionada sem qualquer envio ao PFE.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha no registro.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Estado registrado pela equipe
   <select value={state} onChange={e=>setState(e.target.value)}>
    {Object.entries(COFIEX_STATES).map(([key,label])=>
     <option key={key} value={key}>{label}</option>)}
   </select>
  </label>
  <label>Data da consulta realizada
   <input type="date" min="2000-01-01" max={today} required
    value={date} onChange={e=>setDate(e.target.value)}/>
  </label>
  <label className="protocol-full">Nota e evidência declarada
   <textarea rows={3} required minLength={20} maxLength={1000}
    value={note} onChange={e=>setNote(e.target.value)}
    placeholder="Registre o documento ou orientação consultada, data e o que precisa ser conferido."/>
  </label>
  <label className="protocol-full"><input type="checkbox"
   checked={ack} onChange={e=>setAck(e.target.checked)}/>
   {' '}Estou ciente de que este registro é uma conferência interna,
   não constitui envio ao PFE, autorização COFIEX, aprovação de
   financiamento nem validação jurídica.
  </label>
  <button type="submit" className="btn btn-primary"
   disabled={busy||!ack||note.trim().length<20}>
   {busy?'Gravando…':'Registrar observação desta etapa'}
  </button>
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
  {success&&<p role="status" className="success protocol-full">{success}</p>}
 </form>;
}
