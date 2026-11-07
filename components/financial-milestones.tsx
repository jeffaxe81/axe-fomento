'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
export type ProtocolOption={id:string;protocol_number:string;portal_name:string};
export type ProofOption={id:string;file_name:string;item_title:string;version:number;sha256:string};
export function FinancialMilestoneCreate({projectId,protocols}:{
 projectId:string;protocols:ProtocolOption[];
}){
 const router=useRouter();
 const [protocolId,setProtocolId]=useState(''),[kind,setKind]=useState<'repasse'|'marco'>('repasse');
 const [title,setTitle]=useState(''),[plannedOn,setPlannedOn]=useState('');
 const [plannedAmount,setPlannedAmount]=useState(''),[note,setNote]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/projects/financial-milestones',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,protocolId,kind,title,plannedOn,plannedAmount,note})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Não foi possível registrar a previsão.');
   setProtocolId('');setTitle('');setPlannedOn('');setPlannedAmount('');setNote('');
   setSuccess('Previsão registrada com autoria.');router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Falha ao registrar previsão.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Protocolo vinculado
   <select required value={protocolId} onChange={e=>setProtocolId(e.target.value)}>
    <option value="">Selecione um protocolo</option>
    {protocols.map(p=><option key={p.id} value={p.id}>{p.protocol_number} — {p.portal_name}</option>)}
   </select>
  </label>
  <label>Tipo
   <select value={kind} onChange={e=>setKind(e.target.value as 'repasse'|'marco')}>
    <option value="repasse">Repasse financeiro</option><option value="marco">Marco de execução</option>
   </select>
  </label>
  <label>Título
   <input required minLength={5} maxLength={180} value={title}
    onChange={e=>setTitle(e.target.value)} placeholder="Ex.: primeira parcela"/>
  </label>
  <label>Data prevista
   <input required type="date" min="2000-01-01" max="2100-12-31"
    value={plannedOn} onChange={e=>setPlannedOn(e.target.value)}/>
  </label>
  <label>Valor previsto (R$, sem separador de milhar)
   <input required inputMode="decimal" maxLength={15} value={plannedAmount}
    onChange={e=>setPlannedAmount(e.target.value)}
    placeholder={kind==='marco'?'0,00':'12500,00'}/>
  </label>
  <label className="protocol-full">Origem e premissas do valor/data (10–1000 caracteres)
   <textarea required rows={3} minLength={10} maxLength={1000}
    value={note} onChange={e=>setNote(e.target.value)}
    placeholder="Informe a fonte do cronograma e o caráter previsto do valor."/>
  </label>
  <p className="help protocol-full">Valores e datas são informados pela equipe e não são
   conciliados com extratos bancários nem consultados no portal.</p>
  <button className="btn btn-primary" type="submit"
   disabled={busy||!protocolId||title.trim().length<5||!plannedOn||
    !plannedAmount||note.trim().length<10}>
   {busy?'Registrando…':'Registrar previsão'}</button>
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
  {success&&<p className="success protocol-full" role="status">{success}</p>}
 </form>;
}
export function FinancialMilestoneRealize({milestoneId,proofs,today}:{
 milestoneId:string;proofs:ProofOption[];today:string;
}){
 const router=useRouter();
 const [realizedOn,setRealizedOn]=useState(''),[realizedAmount,setRealizedAmount]=useState('');
 const [proofVersionId,setProofVersionId]=useState(''),[note,setNote]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/projects/financial-milestones/realize',{
    method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({milestoneId,expectedRevision:1,realizedOn,
     realizedAmount,proofVersionId,note})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Não foi possível registrar a realização.');
   setRealizedOn('');setRealizedAmount('');setProofVersionId('');setNote('');
   setSuccess('Realização registrada com prova vinculada.');router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Falha ao registrar realização.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Data realizada
   <input required type="date" min="2000-01-01" max={today} value={realizedOn}
    onChange={e=>setRealizedOn(e.target.value)}/>
  </label>
  <label>Valor efetivamente realizado (R$)
   <input required inputMode="decimal" maxLength={15} placeholder="12500,00"
    value={realizedAmount} onChange={e=>setRealizedAmount(e.target.value)}/>
  </label>
  <label className="protocol-full">Comprovante privado — versão exata
   <select required value={proofVersionId} onChange={e=>setProofVersionId(e.target.value)}>
    <option value="">Selecione o documento do projeto</option>
    {proofs.map(p=><option key={p.id} value={p.id}>
     {p.item_title} · {p.file_name} · v{p.version}</option>)}
   </select>
  </label>
  {proofVersionId&&<p className="help protocol-full">SHA-256 da prova:
   <code>{proofs.find(p=>p.id===proofVersionId)?.sha256}</code></p>}
  <label className="protocol-full">Evidência e observação (10–1000 caracteres)
   <textarea required rows={3} minLength={10} maxLength={1000} value={note}
    onChange={e=>setNote(e.target.value)}
    placeholder="Informe como a equipe verificou o marco ou repasse."/>
  </label>
  <p className="help protocol-full">Este lançamento é declaração municipal, não conciliação bancária.
   A realização fica registrada sem edição neste incremento.</p>
  <button className="btn btn-primary" type="submit"
   disabled={busy||!realizedOn||!realizedAmount||!proofVersionId||note.trim().length<10}>
   {busy?'Registrando…':'Registrar realização com comprovante'}</button>
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
  {success&&<p className="success protocol-full" role="status">{success}</p>}
 </form>;
}
