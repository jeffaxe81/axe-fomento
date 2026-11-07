'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';

export type ProofOption={id:string;file_name:string;version:number;item_title:string;sha256:string};
type ProtocolOption={id:string;protocol_number:string;portal_name:string};
type UserOption={id:string;full_name:string};
export function ProtocolDiligenceCreate({projectId,protocols,users,today}:{
 projectId:string;protocols:ProtocolOption[];users:UserOption[];today:string;
}){
 const router=useRouter();
 const [protocolId,setProtocolId]=useState(''),[assignedTo,setAssignedTo]=useState('');
 const [title,setTitle]=useState(''),[details,setDetails]=useState('');
 const [dueOn,setDueOn]=useState(''),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/projects/diligences',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,protocolId,assignedTo,title,details,dueOn})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Não foi possível registrar a diligência.');
   setProtocolId('');setAssignedTo('');setTitle('');setDetails('');setDueOn('');
   setMessage('Diligência registrada para acompanhamento municipal.');router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao registrar.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Protocolo externo vinculado
   <select required value={protocolId} onChange={e=>setProtocolId(e.target.value)}>
    <option value="">Selecione o protocolo declarado</option>
    {protocols.map(p=><option key={p.id} value={p.id}>{p.protocol_number} — {p.portal_name}</option>)}
   </select>
  </label>
  <label>Responsável municipal
   <select required value={assignedTo} onChange={e=>setAssignedTo(e.target.value)}>
    <option value="">Selecione uma conta ativa</option>
    {users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
   </select>
  </label>
  <label>Título da diligência
   <input required minLength={5} maxLength={180} value={title}
    onChange={e=>setTitle(e.target.value)} placeholder="Ex.: complementar certidão"/>
  </label>
  <label>Prazo informado pelo órgão
   <input required type="date" min="2000-01-01" max="2100-12-31" value={dueOn}
    onChange={e=>setDueOn(e.target.value)}/>
  </label>
  <label className="protocol-full">Solicitação ou orientação recebida (10–1200 caracteres)
   <textarea required rows={3} minLength={10} maxLength={1200}
    value={details} onChange={e=>setDetails(e.target.value)}/>
  </label>
  <p className="help protocol-full">Prazo e solicitação são declarados pela prefeitura.
   Confira o prazo diretamente no órgão. Data de referência: {today.split('-').reverse().join('/')}.</p>
  <button className="btn btn-primary" type="submit"
   disabled={busy||!protocolId||!assignedTo||title.trim().length<5||details.trim().length<10||!dueOn}>
   {busy?'Salvando…':'Registrar diligência'}</button>
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
  {message&&<p className="success protocol-full" role="status">{message}</p>}
 </form>;
}

export function ProtocolDiligenceReply({diligenceId,revision,proofs}:{
 diligenceId:string;revision:number;proofs:ProofOption[];
}){
 const router=useRouter();
 const [responseText,setResponseText]=useState(''),[proofVersionId,setProofVersionId]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/projects/diligences/reply',{
    method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({diligenceId,expectedRevision:revision,proofVersionId,responseText})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Não foi possível registrar a resposta.');
   setResponseText('');setProofVersionId('');
   setMessage('Resposta e versão do comprovante registradas.');router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao responder.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label className="protocol-full">Comprovante da resposta — versão exata
   <select required value={proofVersionId} onChange={e=>setProofVersionId(e.target.value)}>
    <option value="">Selecione um documento do projeto</option>
    {proofs.map(p=><option key={p.id} value={p.id}>
     {p.item_title} · {p.file_name} · v{p.version}</option>)}
   </select>
  </label>
  {proofVersionId&&<p className="help protocol-full">SHA-256:
   <code>{proofs.find(p=>p.id===proofVersionId)?.sha256}</code></p>}
  <label className="protocol-full">Resposta prestada pela equipe (10–1500 caracteres)
   <textarea required rows={3} minLength={10} maxLength={1500}
    value={responseText} onChange={e=>setResponseText(e.target.value)}/>
  </label>
  <p className="help protocol-full">Este registro não envia documentos ou respostas ao órgão.
   Confirme a entrega externa separadamente.</p>
  <button className="btn btn-primary" type="submit"
   disabled={busy||!proofVersionId||responseText.trim().length<10}>
   {busy?'Registrando…':'Registrar resposta e comprovante'}</button>
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
  {message&&<p className="success protocol-full" role="status">{message}</p>}
 </form>;
}
