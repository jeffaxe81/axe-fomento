'use client';
import { useRouter } from 'next/navigation';
import { useState,type FormEvent } from 'react';

type Secretariat={id:string;name:string};
type Member={secretariat_id:string;user_id:string;full_name:string};
export function MunicipalTaskCreate({projectId,secretariats,members}:{
 projectId:string;secretariats:Secretariat[];members:Member[];
}){
 const router=useRouter();
 const [secretariatId,setSecretariatId]=useState(secretariats[0]?.id??'');
 const [assignedTo,setAssignedTo]=useState('');
 const [title,setTitle]=useState(''),[details,setDetails]=useState('');
 const [dueOn,setDueOn]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const available=members.filter(m=>m.secretariat_id===secretariatId);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/projects/tasks',{method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,secretariatId,assignedTo,title,details,dueOn}),
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Não foi possível criar tarefa.');
   setTitle('');setDetails('');setDueOn('');setAssignedTo('');
   setMessage('Tarefa distribuída e registrada com histórico.');
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Falha ao criar tarefa.');}
  finally{setBusy(false);}
 }
 return <section className="panel task-creator" aria-labelledby="create-municipal-task">
  <h2 id="create-municipal-task">Distribuir nova tarefa</h2>
  <p className="help">Atribua somente a integrantes ativos e autorizados de uma secretaria municipal.
   Prazos e documentos devem ser conferidos pela equipe.</p>
  {secretariats.length?
   <form onSubmit={submit} className="task-input-form">
    <label>Secretaria responsável
     <select value={secretariatId} onChange={e=>{setSecretariatId(e.target.value);setAssignedTo('');}} required>
      {secretariats.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
     </select>
    </label>
    <label>Responsável autorizado
     <select value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} required>
      <option value="" disabled>Selecione um integrante da secretaria</option>
      {available.map(m=><option value={m.user_id} key={m.user_id}>{m.full_name}</option>)}
     </select>
    </label>
    <label>Título da tarefa
     <input minLength={5} maxLength={180} required value={title}
      onChange={e=>setTitle(e.target.value)} placeholder="Ex.: reunir documentos para candidatura"/>
    </label>
    <label>Prazo da atividade
     <input type="date" min="2000-01-01" max="2100-12-31" value={dueOn} required
      onChange={e=>setDueOn(e.target.value)}/>
    </label>
    <label className="task-full">Orientação e entregáveis (opcional)
     <textarea maxLength={1200} rows={3} value={details}
      onChange={e=>setDetails(e.target.value)} placeholder="Informe o resultado esperado e a orientação interna." />
    </label>
    <button className="btn btn-primary" type="submit"
     disabled={busy||!assignedTo||!dueOn||title.trim().length<5}>
     {busy?'Distribuindo…':'Criar tarefa'}
    </button>
    {!available.length&&<p className="help task-full">Autorize integrantes desta secretaria antes de distribuir tarefas.</p>}
    {error&&<p className="error task-full" role="alert">{error}</p>}
    {message&&<p className="success task-full" role="status">{message}</p>}
   </form>:
   <p>Cadastre uma secretaria e autorize integrantes em <a href="/administracao/secretarias">
    Administração de secretarias</a> antes de distribuir tarefas.</p>}
 </section>;
}
