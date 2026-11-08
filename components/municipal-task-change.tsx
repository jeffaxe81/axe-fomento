'use client';
import { useRouter } from 'next/navigation';
import { useState,type FormEvent } from 'react';
type Member={secretariat_id:string;user_id:string;full_name:string};
type Action='status'|'transfer'|'deadline';
type Status='pendente'|'em_andamento'|'concluida'|'cancelada';
export function MunicipalTaskChange({
 taskId,initialStatus,initialDue,initialAssignee,initialRevision,secretariatId,
 members,canManage,canUpdateStatus
}:{
 taskId:string;initialStatus:Status;initialDue:string;initialAssignee:string;initialRevision:number;
 secretariatId:string;members:Member[];canManage:boolean;canUpdateStatus:boolean;
}){
 const router=useRouter();
 const [action,setAction]=useState<Action>('status');
 const [status,setStatus]=useState<Status>(initialStatus);
 const [assignedTo,setAssignedTo]=useState(initialAssignee);
 const [dueOn,setDueOn]=useState(initialDue);
 const [note,setNote]=useState('');
 const [revision,setRevision]=useState(initialRevision);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
 const allowed=members.filter(m=>m.secretariat_id===secretariatId);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setMessage('');setFailed(false);
  try{
   const payload={taskId,expectedRevision:revision,note:note.trim(),action,...(
    action==='status'?{status}:action==='transfer'?{assignedTo}:{dueOn})};
   const response=await fetch('/api/projects/tasks/change',{method:'PATCH',
    credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json() as {error?:string;revision?:number;changed?:boolean};
   if(!response.ok)throw new Error(data.error||'Não foi possível alterar tarefa.');
   setRevision(data.revision??revision);
   setMessage(data.changed?'Alteração salva e registrada no histórico.':'Nenhuma mudança a registrar.');
   setNote('');router.refresh();
  }catch(err){setFailed(true);setMessage(err instanceof Error?err.message:'Erro ao salvar.');}
  finally{setBusy(false);}
 }
 if(!canManage&&!canUpdateStatus)return <p className="help">Somente o responsável ativo ou
  um administrador municipal pode alterar esta tarefa.</p>;
 return <form className="task-change-form" onSubmit={submit}>
  {canManage&&<label>Tipo de alteração
    <select value={action} onChange={e=>setAction(e.target.value as Action)}>
     <option value="status">Atualizar situação</option>
     <option value="transfer">Transferir responsável</option>
     <option value="deadline">Alterar prazo</option>
    </select>
   </label>}
  {action==='status'&&<label>Situação
    <select value={status} onChange={e=>setStatus(e.target.value as Status)}>
     <option value="pendente">Pendente</option>
     <option value="em_andamento">Em andamento</option>
     <option value="concluida">Concluída</option>
     <option value="cancelada">Cancelada</option>
    </select>
   </label>}
  {canManage&&action==='transfer'&&<label>Novo responsável da mesma secretaria
   <select value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} required>
    {allowed.map(m=><option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
   </select>
  </label>}
  {canManage&&action==='deadline'&&<label>Novo prazo
   <input type="date" min="2000-01-01" max="2100-12-31" required
    value={dueOn} onChange={e=>setDueOn(e.target.value)}/>
  </label>}
  <label className="task-full">Motivo e evidência da alteração
   <textarea required minLength={10} maxLength={500} rows={2} value={note}
    onChange={e=>setNote(e.target.value)}
    placeholder="Descreva o andamento, a razão da transferência ou a alteração de prazo."/>
  </label>
  <button type="submit" className="btn btn-outline" disabled={busy||note.trim().length<10||
   (action==='transfer'&&!assignedTo)}>
   {busy?'Registrando…':'Registrar alteração'}
  </button>
  {message&&<p role={failed?'alert':'status'} className={failed?'error':'success'}>{message}</p>}
 </form>;
}
