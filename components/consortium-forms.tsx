'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';
async function post(url:string,body:unknown){
 const r=await fetch(url,{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json() as {error?:string};
 if(!r.ok)throw new Error(data.error||'Ação indisponível.');
}
export function CreateConsortiumForm(){
 const router=useRouter(),[title,setTitle]=useState(''),[purpose,setPurpose]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');setSuccess('');
  try{await post('/api/consortia',{title,purpose});setTitle('');setPurpose('');
   setSuccess('Consórcio interno criado; nenhum município foi admitido automaticamente.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Erro');}finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Nome do consórcio
   <input value={title} minLength={6} maxLength={160} required onChange={e=>setTitle(e.target.value)}/>
  </label>
  <label className="protocol-full">Finalidade institucional
   <textarea rows={3} value={purpose} required minLength={20} maxLength={800}
    onChange={e=>setPurpose(e.target.value)}/>
  </label>
  <button type="submit" className="btn btn-primary" disabled={busy}>
   {busy?'Cadastrando…':'Cadastrar consórcio'}</button>
  {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 </form>;
}
export type MunicipalityChoice={id:string;name:string;uf:string};
export function InviteConsortiumMember({consortiumId,municipalities}:{
 consortiumId:string;municipalities:MunicipalityChoice[]
}){
 const router=useRouter(),[selected,setSelected]=useState(municipalities[0]?.id||'');
 const [note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');setSuccess('');
  try{await post('/api/consortia/invitations',{
    consortiumId,municipalityId:selected,note});
   setNote('');setSuccess('Convite enviado para aceite por administrador da prefeitura convidada.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Erro');}finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Município convidado
   <select value={selected} onChange={e=>setSelected(e.target.value)}
    disabled={!municipalities.length}>
    {municipalities.map(m=><option key={m.id} value={m.id}>{m.name} / {m.uf}</option>)}
   </select>
  </label>
  <label className="protocol-full">Justificativa do convite
   <textarea required minLength={10} maxLength={500} rows={2}
    value={note} onChange={e=>setNote(e.target.value)}/>
  </label>
  <button type="submit" className="btn btn-primary" disabled={busy||!selected}>
   {busy?'Convidando…':'Convidar prefeitura'}</button>
  {!municipalities.length&&<p>Não há municípios cadastrados disponíveis no diretório.</p>}
  {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 </form>;
}
export function ConsortiumMembershipAction({membershipId,revision,action,label}:{
 membershipId:string;revision:number;action:'accept'|'decline'|'revoke';label:string
}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function run(){
  if(busy)return;setBusy(true);setError('');
  try{await post('/api/consortia/membership-state',{
   membershipId,expectedRevision:revision,action,
   note:action==='accept'?'Adesão institucional autorizada pelo município convidado.':
    action==='decline'?'Convite institucional recusado pelo município convidado.':
     'Participação institucional revogada pelo representante autorizado.'
  });router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha na transição.');}
  finally{setBusy(false);}
 }
 return <span><button type="button" className="btn btn-outline"
  disabled={busy} onClick={()=>void run()}>{busy?'Registrando…':label}</button>
  {error&&<span role="alert">{error}</span>}</span>;
}
export function ShareConsortiumProjectForm({consortiumId,projects}:{
 consortiumId:string;projects:{id:string;title:string}[]
}){
 const router=useRouter(),[projectId,setProject]=useState(projects[0]?.id||'');
 const [publicTitle,setTitle]=useState(''),[sharedSummary,setSummary]=useState('');
 const [note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');setSuccess('');
  try{await post('/api/consortia/shares',{consortiumId,projectId,publicTitle,
   sharedSummary,note});setTitle('');setSummary('');setNote('');
   setSuccess('Somente este título público e resumo foram autorizados para integrantes ativos.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao compartilhar.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Projeto municipal de origem
   <select value={projectId} disabled={!projects.length}
    onChange={e=>setProject(e.target.value)}>
    {projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
   </select>
  </label>
  <label>Título público criado para cooperação
   <input required minLength={6} maxLength={160} value={publicTitle}
    onChange={e=>setTitle(e.target.value)}/>
  </label>
  <label className="protocol-full">Resumo selecionado explicitamente (sem anexos)
   <textarea required minLength={40} maxLength={2000} rows={5}
    value={sharedSummary} onChange={e=>setSummary(e.target.value)}/>
  </label>
  <label className="protocol-full">Justificativa da autorização de compartilhamento
   <textarea required minLength={10} maxLength={500} rows={2}
    value={note} onChange={e=>setNote(e.target.value)}/>
  </label>
  <p className="help protocol-full">Nenhum campo da carteira, documento, registro SIP,
   orçamento ou anexo é copiado automaticamente. Revise o texto antes de salvar.</p>
  <button type="submit" className="btn btn-primary" disabled={busy||!projectId}>
   {busy?'Compartilhando…':'Autorizar somente este resumo'}</button>
  {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 </form>;
}
export function RevokeConsortiumShare({shareId,revision}:{
 shareId:string;revision:number
}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function revoke(){
  if(busy)return;setBusy(true);setError('');
  try{await post('/api/consortia/shares/revoke',{shareId,expectedRevision:revision,
   note:'Autorização de acesso ao resumo revogada pelo município responsável.'});
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível revogar.');}
  finally{setBusy(false);}
 }
 return <span><button type="button" className="btn btn-outline"
  disabled={busy} onClick={()=>void revoke()}>
  {busy?'Revogando…':'Revogar acesso ao resumo'}</button>
  {error&&<span role="alert">{error}</span>}</span>;
}
