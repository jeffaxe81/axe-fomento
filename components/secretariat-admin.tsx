'use client';
import { useRouter } from 'next/navigation';
import { useState,type FormEvent } from 'react';

type Secretariat={id:string;name:string};
type User={id:string;full_name:string;role:string};
type Member={secretariat_id:string;user_id:string;full_name:string;revoked_at:string|null};
export function SecretariatAdmin({secretariats,users,members}:{
 secretariats:Secretariat[];users:User[];members:Member[];
}){
 const router=useRouter();
 const [name,setName]=useState('');
 const [secretariatId,setSecretariatId]=useState(secretariats[0]?.id||'');
 const [userId,setUserId]=useState(users[0]?.id||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function send(path:string,method:'POST'|'PATCH',payload:object){
  const response=await fetch(path,{method,credentials:'same-origin',
   headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json() as {error?:string;changed?:boolean};
  if(!response.ok)throw new Error(data.error||'Operação não concluída.');
  return data;
 }
 async function act(task:()=>Promise<void>){
  if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{await task();router.refresh();}
  catch(err){setError(err instanceof Error?err.message:'Falha ao salvar.');}
  finally{setBusy(false);}
 }
 function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  void act(async()=>{
   await send('/api/secretariats','POST',{name});
   setName('');setMessage('Secretaria criada. Administrador incluído como integrante inicial.');
  });
 }
 function grant(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  void act(async()=>{
   await send('/api/secretariats/members','POST',{secretariatId,userId});
   setMessage('Vínculo registrado ou já ativo.');
  });
 }
 function revoke(departmentId:string,memberId:string){
  void act(async()=>{
   await send('/api/secretariats/members','PATCH',{secretariatId:departmentId,userId:memberId});
   setMessage('Vínculo revogado. O histórico foi preservado.');
  });
 }
 return <div className="task-admin">
  <section className="panel">
   <h2>Cadastrar secretaria municipal</h2>
   <p className="help">Utilize apenas áreas administrativas existentes na prefeitura.
    A nomenclatura é declarada pelo administrador e não é verificada automaticamente.</p>
   <form className="task-input-form" onSubmit={create}>
    <label>Nome da secretaria
     <input required minLength={3} maxLength={120} value={name}
      onChange={e=>setName(e.target.value)} placeholder="Ex.: Secretaria Municipal de Planejamento"/>
    </label>
    <button className="btn btn-primary" disabled={busy} type="submit">Cadastrar secretaria</button>
   </form>
  </section>
  <section className="panel">
   <h2>Autorizar integrante de secretaria</h2>
   <p className="help">Só contas ativas do município podem receber tarefas na secretaria.
    É possível vincular um mesmo usuário a mais de uma secretaria.</p>
   {secretariats.length&&users.length?<form className="task-input-form" onSubmit={grant}>
    <label>Secretaria
     <select value={secretariatId} onChange={e=>setSecretariatId(e.target.value)} required>
      {secretariats.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
     </select>
    </label>
    <label>Usuário ativo
     <select value={userId} onChange={e=>setUserId(e.target.value)} required>
      {users.map(u=><option value={u.id} key={u.id}>{u.full_name} ({u.role})</option>)}
     </select>
    </label>
    <button type="submit" disabled={busy} className="btn btn-primary">Autorizar integrante</button>
   </form>:<p className="muted">Cadastre uma secretaria antes de associar usuários.</p>}
  </section>
  {error&&<p className="error" role="alert">{error}</p>}
  {message&&<p className="success" role="status">{message}</p>}
  <section className="panel">
   <h2>Secretarias e seus integrantes</h2>
   {secretariats.length?secretariats.map(s=><div className="task-department" key={s.id}>
    <h3>{s.name}</h3>
    {members.filter(m=>m.secretariat_id===s.id&&m.revoked_at===null).length?
     members.filter(m=>m.secretariat_id===s.id&&m.revoked_at===null).map(m=><div key={m.user_id} className="task-member">
      <span>{m.full_name}</span>
      <button className="btn btn-outline" disabled={busy} type="button"
       onClick={()=>revoke(s.id,m.user_id)}>Revogar vínculo</button>
     </div>):
     <p className="muted">Sem integrantes ativos autorizados.</p>}
   </div>):<p className="muted">Nenhuma secretaria cadastrada neste município.</p>}
  </section>
 </div>;
}
