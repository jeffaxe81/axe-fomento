'use client';
import { useRouter } from 'next/navigation';
import { useState,type FormEvent } from 'react';

export function DocumentVersionUpload({projectId,itemId}:{
 projectId:string;itemId:string;
}){
 const router=useRouter();
 const [file,setFile]=useState<File|null>(null);
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [failed,setFailed]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!file||busy)return;
  setBusy(true);setMessage('');setFailed(false);
  try{
   const payload=new FormData();
   payload.set('projectId',projectId);
   payload.set('itemId',itemId);
   payload.set('note',note);
   payload.set('file',file);
   const response=await fetch('/api/projects/document-attachments',{
    method:'POST',credentials:'same-origin',body:payload,
   });
   const data=await response.json() as {error?:string;version?:number};
   if(!response.ok)throw new Error(data.error||'Falha ao anexar documento.');
   setMessage('Nova versão '+data.version+' armazenada e protegida. Confira o histórico abaixo.');
   setNote('');setFile(null);
   const selector=document.getElementById('attachment-'+itemId) as HTMLInputElement|null;
   if(selector)selector.value='';
   router.refresh();
  }catch(error){
   setFailed(true);setMessage(error instanceof Error?error.message:'Não foi possível enviar.');
  }finally{setBusy(false);}
 }
 return <form className="document-attachment-form" onSubmit={(event)=>void submit(event)}>
  <label>Adicionar uma nova versão privada (PDF, PNG ou JPEG, até 2 MiB)
   <input id={'attachment-'+itemId} type="file" required
    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
    onChange={(e)=>setFile(e.target.files?.[0]??null)}/>
  </label>
  <label>Motivo ou descrição da nova versão
   <textarea required minLength={10} maxLength={500} rows={2} value={note}
    onChange={(e)=>setNote(e.target.value)}
    placeholder="Ex.: documento atualizado após revisão da secretaria."/>
  </label>
  <p className="help">O arquivo será cifrado no servidor. O envio não altera automaticamente
   a situação do checklist e não significa aprovação do documento.</p>
  <button className="btn btn-outline" type="submit" disabled={busy||!file||file.size>2097152||
   note.trim().length<10}>
    {busy?'Protegendo documento…':'Enviar nova versão'}
  </button>
  {message&&<p className={failed?'error':'success'} role={failed?'alert':'status'}>{message}</p>}
 </form>;
}
