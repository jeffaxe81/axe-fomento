'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';

type Decision='submit'|'technical_approve'|'return'|'authorize';
type ReviewState='sem_revisao'|'em_revisao'|'revisada'|'devolvida'|'autorizada';
const labels:Record<Decision,string>={
 submit:'Enviar candidatura para revisão interna',
 technical_approve:'Aprovar revisão técnica',
 return:'Devolver para correções',
 authorize:'Autorizar internamente a candidatura',
};
export function InternalReviewActions({projectId,revision,state,canSubmit,canReview,canAuthorize,ready}:{
 projectId:string;revision:number;state:ReviewState;
 canSubmit:boolean;canReview:boolean;canAuthorize:boolean;ready:boolean;
}){
 const router=useRouter();
 const options:Decision[]=[];
 if(canSubmit&&(state==='sem_revisao'||state==='devolvida'))options.push('submit');
 if(canReview&&state==='em_revisao'){
  options.push('technical_approve','return');
 }
 if(canReview&&state==='revisada')options.push('return');
 if(canAuthorize&&state==='revisada')options.push('authorize');
 const [action,setAction]=useState<Decision>(options[0]??'submit');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
 if(!options.length)return <p className="help">Nenhuma decisão está disponível para esta conta na etapa atual.</p>;
 const selected=options.includes(action)?action:options[0];
 const blockedByGate=(selected==='technical_approve'||selected==='authorize')&&!ready;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setMessage('');setFailed(false);
  try{
   const response=await fetch('/api/projects/internal-review',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,expectedRevision:revision,action:selected,note:note.trim()})});
   const body=await response.json() as {error?:string;revision?:number};
   if(!response.ok)throw new Error(body.error||'Não foi possível registrar a decisão.');
   setNote('');setMessage('Decisão registrada. Revisão '+body.revision+'.');
   router.refresh();
  }catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Erro ao salvar.');}
  finally{setBusy(false);}
 }
 return <form className="internal-review-form" onSubmit={(e)=>void submit(e)}>
  <label>Decisão ou encaminhamento
   <select value={selected} onChange={e=>setAction(e.target.value as Decision)}>
    {options.map(o=><option key={o} value={o}>{labels[o]}</option>)}
   </select>
  </label>
  <label>Justificativa, evidência ou correção necessária
   <textarea required rows={4} value={note} minLength={10} maxLength={500}
    onChange={e=>setNote(e.target.value)}
    placeholder="Registre o motivo e a evidência desta decisão interna. Evite dados pessoais desnecessários." />
  </label>
  {blockedByGate&&<p className="note">Aprovação ou autorização bloqueada:
   conclua o checklist, as tarefas em aberto e os requisitos obrigatórios.</p>}
  <button className="btn btn-primary" disabled={busy||note.trim().length<10||blockedByGate}
   type="submit">{busy?'Registrando decisão…':labels[selected]}</button>
  {message&&<p className={failed?'error':'success'} role={failed?'alert':'status'}>{message}</p>}
 </form>;
}
