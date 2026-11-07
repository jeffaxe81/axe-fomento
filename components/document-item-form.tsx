'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';
type Status='pendente'|'apresentado'|'dispensado';
export function DocumentItemForm({projectId,itemId,initialStatus,initialNote}:{
 projectId:string;itemId:string;initialStatus:Status;initialNote:string;
}){
 const router=useRouter();
 const [status,setStatus]=useState<Status>(initialStatus);
 const [evidenceNote,setEvidenceNote]=useState(initialNote);
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setFailed(false);setMessage('');
  try{
   const response=await fetch('/api/projects/document-item',{method:'PATCH',credentials:'same-origin',
     headers:{'content-type':'application/json'},
     body:JSON.stringify({projectId,itemId,status,evidenceNote})});
   const data=await response.json() as {error?:string;changed?:boolean};
   if(!response.ok)throw new Error(data.error||'Falha na atualização do documento.');
   setMessage(data.changed?'Situação e histórico atualizados.':'Nenhuma alteração encontrada.');
   router.refresh();
  }catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Erro de gravação.');}
  finally{setBusy(false);}
 }
 return <form className="document-item-form" onSubmit={(event)=>void submit(event)}>
  <label>Situação declarada
   <select value={status} onChange={(e)=>setStatus(e.target.value as Status)}>
    <option value="pendente">Pendente de comprovação</option>
    <option value="apresentado">Documento apresentado (declarado)</option>
    <option value="dispensado">Dispensado (justificar)</option>
   </select>
  </label>
  <label>Comprovação, protocolo ou justificativa
   <textarea maxLength={1000} rows={2} value={evidenceNote}
     onChange={(e)=>setEvidenceNote(e.target.value)}
     placeholder="Registre o documento/referência ou motivo da dispensa. Arquivos ainda não são anexados." />
  </label>
  <button className="btn btn-outline" type="submit"
   disabled={busy||(status!=='pendente'&&evidenceNote.trim().length<10)}>
   {busy?'Atualizando…':'Salvar situação'}
  </button>
  {message&&<span role={failed?'alert':'status'} className={failed?'error':'success'}>{message}</span>}
 </form>;
}
