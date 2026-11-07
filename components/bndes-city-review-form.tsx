'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';
import {BNDES_SOURCE_STATES,BNDES_AVAILABILITY_STATES}
 from '@/lib/bndes-city-labels.mjs';

type Entry={code:string;title:string;revision:number|null};
type ReviewItem={code:string;expectedRevision:number;sourceState:string;
 availabilityState:string;checkedOn:string;note:string;acknowledgedLimits:true};

export function BndesCityReviewForm({entries,today,compact=false}:{
 entries:Entry[];today:string;compact?:boolean
}){
 const router=useRouter();
 const [selected,setSelected]=useState<string[]>([]);
 const [sourceState,setSourceState]=useState('atualizacao_pendente');
 const [availabilityState,setAvailabilityState]=useState('nao_apurada');
 const [checkedOn,setCheckedOn]=useState(today);
 const [note,setNote]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),
  [success,setSuccess]=useState('');
 const chosen=compact?entries.map(e=>e.code):selected;
 const disabled=busy||!chosen.length||chosen.length>20||note.trim().length<20||
  !confirmed||!checkedOn||
  (sourceState==='pagina_indisponivel'&&availabilityState==='possibilidade_mencionada');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(disabled)return;setBusy(true);setError('');setSuccess('');
  try{
   const items:ReviewItem[]=entries.filter(i=>chosen.includes(i.code)).map(i=>({
    code:i.code,expectedRevision:i.revision??0,sourceState,
    availabilityState,checkedOn,note,acknowledgedLimits:true
   }));
   const response=await fetch('/api/bndes-cidades/reviews/batch',{
    method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},body:JSON.stringify({items})
   });
   const result=await response.json() as {error?:string;saved?:number};
   if(!response.ok)throw new Error(result.error||'Erro ao registrar o lote.');
   setSuccess(String(result.saved??items.length)+
    ' referências registradas em versão histórica, sem confirmar oferta de financiamento.');
   setSelected([]);setNote('');setConfirmed(false);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar a conferência.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  {!compact&&<fieldset className="protocol-full">
   <legend>Selecione até 20 referências desta página ({chosen.length}/20)</legend>
   <div className="review-events">{entries.map(v=><label key={v.code}
    className="review-event">
    <input type="checkbox" checked={selected.includes(v.code)}
     disabled={!selected.includes(v.code)&&selected.length>=20}
     onChange={e=>setSelected(old=>e.target.checked?
      [...old,v.code]:old.filter(code=>code!==v.code))}/>
    {' '}{v.title} · última revisão municipal: {v.revision??'nenhuma'}
   </label>)}</div>
  </fieldset>}
  <label>Situação da referência na conferência humana
   <select value={sourceState} onChange={e=>setSourceState(e.target.value)}>
    {Object.entries(BNDES_SOURCE_STATES).map(([k,v])=><option
     value={k} key={k}>{v}</option>)}
   </select>
  </label>
  <label>Disponibilidade citada (não é crédito confirmado)
   <select value={availabilityState} onChange={e=>setAvailabilityState(e.target.value)}>
    {Object.entries(BNDES_AVAILABILITY_STATES).map(([k,v])=><option
     key={k} value={k}>{v}</option>)}
   </select>
  </label>
  <label>Data de conferência humana
   <input required type="date" min="2000-01-01" max={today}
    value={checkedOn} onChange={e=>setCheckedOn(e.target.value)}/>
  </label>
  <label className="protocol-full">Observação documentada
   <textarea required minLength={20} maxLength={1000} rows={3}
    value={note} onChange={e=>setNote(e.target.value)}
    placeholder="Descreva o que foi observado e as pendências de confirmação no BNDES."/>
  </label>
  <label className="protocol-full"><input type="checkbox"
   checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
   {' '}Confirmo que se trata de uma declaração municipal, sem
   verificação automática da disponibilidade, taxa ou elegibilidade do crédito.
  </label>
  <button type="submit" className="btn btn-primary" disabled={disabled}>
   {busy?'Registrando…':compact?'Registrar conferência desta referência':
    'Registrar conferência em lote (até 20)'}
  </button>
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
  {success&&<p role="status" className="success protocol-full">{success}</p>}
 </form>;
}
