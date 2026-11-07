'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';

type Proof={id:string;file_name:string;version:number;item_title:string;sha256:string};
export function ExternalProtocolForm({projectId,reviewRevision,proofs,today}:{
 projectId:string;reviewRevision:number;proofs:Proof[];today:string;
}){
 const router=useRouter();
 const [portalName,setPortalName]=useState('');
 const [portalUrl,setPortalUrl]=useState('');
 const [protocolNumber,setProtocolNumber]=useState('');
 const [submittedOn,setSubmittedOn]=useState('');
 const [proofVersionId,setProofVersionId]=useState('');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/projects/external-protocols',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,reviewRevision,portalName,portalUrl,
     protocolNumber,submittedOn,proofVersionId,note}),
   });
   const data=await response.json() as {error?:string;id?:string};
   if(!response.ok)throw new Error(data.error||'Não foi possível registrar o protocolo.');
   setPortalName('');setPortalUrl('');setProtocolNumber('');
   setSubmittedOn('');setProofVersionId('');setNote('');
   setMessage('Registro interno incluído com referência ao comprovante.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao registrar protocolo.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Nome do portal de submissão
   <input required minLength={3} maxLength={120} value={portalName}
    placeholder="Ex.: portal de convênios estadual"
    onChange={e=>setPortalName(e.target.value)}/>
  </label>
  <label>URL HTTPS do portal consultado
   <input required type="url" maxLength={500} value={portalUrl}
    placeholder="https://portal.exemplo.gov.br/consulta"
    onChange={e=>setPortalUrl(e.target.value)}/>
  </label>
  <label>Número informado do protocolo
   <input required minLength={3} maxLength={160} value={protocolNumber}
    placeholder="Identificador exatamente como recebido"
    onChange={e=>setProtocolNumber(e.target.value)}/>
  </label>
  <label>Data efetiva da submissão
   <input required type="date" min="2000-01-01" max={today}
    value={submittedOn} onChange={e=>setSubmittedOn(e.target.value)}/>
  </label>
  <label className="protocol-full">Comprovante já anexado ao projeto — versão imutável
   <select required value={proofVersionId} onChange={e=>setProofVersionId(e.target.value)}>
    <option value="" disabled>Selecione a versão exata do comprovante</option>
    {proofs.map(p=><option value={p.id} key={p.id}>
     {p.item_title} · {p.file_name} · v{p.version}
    </option>)}
   </select>
  </label>
  {proofVersionId&&<p className="help protocol-full">
   SHA-256 registrado do anexo: <code>{proofs.find(p=>p.id===proofVersionId)?.sha256}</code>
  </p>}
  <label className="protocol-full">Observação e evidência da informação (10–500 caracteres)
   <textarea required rows={3} minLength={10} maxLength={500} value={note}
    placeholder="Ex.: equipe conferiu o número na confirmação do portal."
    onChange={e=>setNote(e.target.value)}/>
  </label>
  <p className="help protocol-full">O sistema apenas documenta informações declaradas pela
   equipe municipal. Não consulta nem confirma o número no portal e não efetua a submissão.</p>
  <button type="submit" className="btn btn-primary" disabled={busy||!proofVersionId||
   !submittedOn||!portalName.trim()||!protocolNumber.trim()||note.trim().length<10}>
   {busy?'Registrando…':'Registrar protocolo informado'}
  </button>
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
  {message&&<p className="success protocol-full" role="status">{message}</p>}
 </form>;
}
