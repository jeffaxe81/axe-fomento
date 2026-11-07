'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {CALL_LANGUAGE,CALL_MODALITY,CALL_SCOPE,CALL_STATE,ROUTE_TYPE,ROUTE_STATE}
 from '@/lib/cooperation-labels.mjs';
const today=()=>new Date().toISOString().slice(0,10);
async function save(url:string,body:unknown){
 const response=await fetch(url,{method:'POST',credentials:'same-origin',
  headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json() as {error?:string};
 if(!response.ok)throw new Error(data.error||'Não foi possível registrar.');
}
export function CooperationCallForm(){
 const router=useRouter();
 const [code,setCode]=useState(''),[title,setTitle]=useState('');
 const [institution,setInstitution]=useState(''),[language,setLanguage]=useState('pt');
 const [scope,setScope]=useState('to_confirm'),[modality,setModality]=useState('to_confirm');
 const [url,setUrl]=useState(''),[review,setReview]=useState('to_verify');
 const [date,setDate]=useState(''),[notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess('');
  try{
   await save('/api/cooperation/calls',{code,title,institution,language,scope,modality,
    officialUrl:url,reviewState:review,checkedOn:date||null,notes});
   setCode('');setTitle('');setInstitution('');setUrl('');setDate('');setNotes('');
   setSuccess('Referência municipal registrada. Não equivale a chamada aberta.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao cadastrar.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Código municipal da referência
   <input required minLength={3} maxLength={60} value={code}
    onChange={e=>setCode(e.target.value.toUpperCase())}
    placeholder="COOP-0001"/>
  </label>
  <label>Título da chamada ou referência
   <input required minLength={6} maxLength={180} value={title}
    onChange={e=>setTitle(e.target.value)}/>
  </label>
  <label>Instituição
   <input required minLength={4} maxLength={160} value={institution}
    onChange={e=>setInstitution(e.target.value)}/>
  </label>
  <label>Idioma
   <select value={language} onChange={e=>setLanguage(e.target.value)}>
    {Object.entries(CALL_LANGUAGE).map(([k,v])=><option key={k} value={k}>{v}</option>)}
   </select>
  </label>
  <label>Abrangência informada
   <select value={scope} onChange={e=>setScope(e.target.value)}>
    {Object.entries(CALL_SCOPE).map(([k,v])=><option key={k} value={k}>{v}</option>)}
   </select>
  </label>
  <label>Modalidade informada
   <select value={modality} onChange={e=>setModality(e.target.value)}>
    {Object.entries(CALL_MODALITY).map(([k,v])=><option key={k} value={k}>{v}</option>)}
   </select>
  </label>
  <label className="protocol-full">Link institucional público HTTPS (sem parâmetros)
   <input required type="url" maxLength={500} value={url}
    onChange={e=>setUrl(e.target.value)}/>
  </label>
  <label>Estado de conferência
   <select value={review} onChange={e=>setReview(e.target.value)}>
    {Object.entries(CALL_STATE).map(([k,v])=><option key={k} value={k}>{v}</option>)}
   </select>
  </label>
  <label>Data da consulta humana
   <input type="date" max={today()} min="2000-01-01"
    required={review==='checked_reference'} value={date}
    onChange={e=>setDate(e.target.value)}/>
  </label>
  <label className="protocol-full">Nota sobre a fonte e suas limitações
   <textarea required minLength={20} maxLength={1000} rows={3} value={notes}
    onChange={e=>setNotes(e.target.value)}/>
  </label>
  <button className="btn btn-primary" disabled={busy} type="submit">
   {busy?'Registrando…':'Cadastrar referência de cooperação'}</button>
  {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 </form>;
}
export function CooperationRouteForm({callId}:{callId:string}){
 const router=useRouter();
 const [routeType,setType]=useState('to_confirm'),[contactName,setContact]=useState('');
 const [contactUrl,setUrl]=useState(''),[verification,setVerification]=useState('reported');
 const [checkedOn,setDate]=useState(''),[applicationSteps,setSteps]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess('');
  try{
   await save('/api/cooperation/routes',{callId,routeType,contactName,contactUrl,
    verification,checkedOn:checkedOn||null,applicationSteps});
   setContact('');setUrl('');setDate('');setSteps('');
   setSuccess('Rota informada registrada sem presumir candidatura disponível.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao registrar rota.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Rota de candidatura
   <select value={routeType} onChange={e=>setType(e.target.value)}>
    {Object.entries(ROUTE_TYPE).map(([k,v])=><option value={k} key={k}>{v}</option>)}
   </select>
  </label>
  <label>Contato ou unidade institucional
   <input required minLength={5} maxLength={160} value={contactName}
    onChange={e=>setContact(e.target.value)}/>
  </label>
  <label className="protocol-full">Página institucional de contato
   <input type="url" required value={contactUrl} maxLength={500}
    onChange={e=>setUrl(e.target.value)}/>
  </label>
  <label>Situação da conferência do contato
   <select value={verification} onChange={e=>setVerification(e.target.value)}>
    {Object.entries(ROUTE_STATE).map(([k,v])=><option key={k} value={k}>{v}</option>)}
   </select>
  </label>
  <label>Data de consulta (se houver)
   <input type="date" max={today()} min="2000-01-01"
    required={verification==='checked_internally'}
    value={checkedOn} onChange={e=>setDate(e.target.value)}/>
  </label>
  <label className="protocol-full">Passos para confirmar ou realizar candidatura
   <textarea required minLength={25} maxLength={1200} rows={3}
    value={applicationSteps} onChange={e=>setSteps(e.target.value)}/>
  </label>
  <button className="btn btn-primary" disabled={busy} type="submit">
   {busy?'Registrando…':'Adicionar rota documental'}</button>
  {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 </form>;
}
