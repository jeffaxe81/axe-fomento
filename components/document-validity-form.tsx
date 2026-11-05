'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { expiryStatus } from '@/lib/document-validity.mjs';

type Owner={id:string;full_name:string};
export function DocumentValidityForm({
 projectId,itemId,owners,today,initialValidUntil,initialOwnerId,initialOwnerName,initialNote
}:{
 projectId:string;itemId:string;owners:Owner[];today:string;
 initialValidUntil:string|null;initialOwnerId:string|null;
 initialOwnerName:string|null;initialNote:string;
}){
 const router=useRouter();
 const [validUntil,setValidUntil]=useState(initialValidUntil??'');
 const [renewalOwnerId,setRenewalOwnerId]=useState(initialOwnerId??'');
 const [evidenceNote,setEvidenceNote]=useState(initialNote);
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[message,setMessage]=useState('');
 const status=expiryStatus(initialValidUntil,today);
 const isInactive=!!initialOwnerId&&!owners.some(owner=>owner.id===initialOwnerId);

 async function save(valid:string|null,owner:string|null,note:string){
  setBusy(true);setMessage('');setFailed(false);
  try{
   const response=await fetch('/api/projects/document-validity',{
    method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,itemId,validUntil:valid,
      renewalOwnerId:owner,evidenceNote:note}),
   });
   const data=await response.json() as {error?:string;changed?:boolean};
   if(!response.ok)throw new Error(data.error||'Não foi possível registrar validade.');
   setMessage(data.changed?'Validade e histórico atualizados.':'Não houve alteração na validade.');
   if(valid===null){
    setValidUntil('');setRenewalOwnerId('');setEvidenceNote('');
   }
   router.refresh();
  }catch(error){
   setFailed(true);setMessage(error instanceof Error?error.message:'Falha na operação.');
  }finally{setBusy(false);}
 }
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!busy)void save(validUntil,renewalOwnerId,evidenceNote.trim());
 }
 return <section className="document-validity" aria-label="Validade e responsável pelo documento">
  <h4>Validade do documento</h4>
  <div className="document-validity-state">
   <strong>{status.label}</strong>
   {initialValidUntil&&<span>Data declarada: {initialValidUntil.split('-').reverse().join('/')}
    {status.days!==null&&' · '+(status.days<0?'Vencido há '+(-status.days)+' dias':
      'Restam '+status.days+' dia(s)')}</span>}
   {initialOwnerName&&<span>Renovação: {initialOwnerName}{isInactive?' (conta inativa: reatribuir)':''}</span>}
   {initialNote&&<span>Fonte ou evidência declarada: {initialNote}</span>}
  </div>
  <form className="document-validity-form" onSubmit={submit}>
   <label>Data de validade informada pela equipe
    <input type="date" required min="2000-01-01" max="2100-12-31"
     value={validUntil} onChange={event=>setValidUntil(event.target.value)}/>
   </label>
   <label>Responsável municipal pela renovação
    <select required value={renewalOwnerId}
     onChange={event=>setRenewalOwnerId(event.target.value)}>
     <option value="" disabled>Selecione uma conta ativa</option>
     {isInactive&&<option value={initialOwnerId??''} disabled>
      {initialOwnerName??'Responsável anterior'} — conta inativa
     </option>}
     {owners.map(owner=><option value={owner.id} key={owner.id}>{owner.full_name}</option>)}
    </select>
   </label>
   <label>Fonte da validade e justificativa do prazo
    <textarea rows={2} required minLength={10} maxLength={500}
      value={evidenceNote} onChange={event=>setEvidenceNote(event.target.value)}
      placeholder="Ex.: documento emitido em 10/09/2026, válido até 10/09/2027."/>
   </label>
   <p className="help">Prazo declarado por pessoa autorizada. O sistema não calcula validade jurídica,
    não renova certificados e não envia notificações automáticas.</p>
   <div className="document-validity-actions">
    <button type="submit" className="btn btn-outline" disabled={busy||!validUntil||
     !renewalOwnerId||evidenceNote.trim().length<10}>{busy?'Salvando…':'Registrar validade'}</button>
    {initialValidUntil&&<button type="button" className="btn btn-light" disabled={busy}
      onClick={()=>void save(null,null,'')}>Remover validade registrada</button>}
   </div>
   {message&&<p role={failed?'alert':'status'} className={failed?'error':'success'}>{message}</p>}
  </form>
 </section>;
}
