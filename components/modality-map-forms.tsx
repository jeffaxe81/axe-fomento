'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {MODALITIES,REVIEW_STATES} from '@/lib/modality-map.mjs';

export type NormativeVersionOption={id:string;reference_code:string;title:string;version:number;source_section:string};
export function AddModalityCheck({projectId,options}:{
 projectId:string;options:NormativeVersionOption[]
}){
 const router=useRouter();
 const [modality,setModality]=useState('convenio');
 const [ruleNumber,setRuleNumber]=useState('1');
 const [criterion,setCriterion]=useState('');
 const [normativeVersionId,setNormativeVersionId]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setMessage('');setError('');
  try{
   const response=await fetch('/api/projects/modality-map',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,modality,ruleNumber:Number(ruleNumber),
     criterion,normativeVersionId})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Falha ao registrar critério.');
   setCriterion('');setRuleNumber(String(Math.min(200,Number(ruleNumber)+1)));
   setMessage('Critério incluído como pendente; revisão humana obrigatória.');
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível registrar.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void save(e)}>
  <label>Modalidade
   <select value={modality} onChange={e=>{setModality(e.target.value);setRuleNumber('1');}}>
    {MODALITIES.map(([key,name])=><option value={key} key={key}>{name}</option>)}
   </select>
  </label>
  <label>Número do critério
   <input type="number" required min="1" max="200" step="1" value={ruleNumber}
    onChange={e=>setRuleNumber(e.target.value)}/>
  </label>
  <label className="protocol-full">Ponto a conferir com a equipe municipal
   <textarea required minLength={10} maxLength={500} rows={3}
    value={criterion} onChange={e=>setCriterion(e.target.value)}
    placeholder="Ex.: Confirmar se a documentação municipal atende às exigências do dispositivo."/>
  </label>
  <label className="protocol-full">Versão normativa exata que fundamenta o critério
   <select required value={normativeVersionId}
    onChange={e=>setNormativeVersionId(e.target.value)}>
    <option value="">Selecionar norma e versão</option>
    {options.map(o=><option key={o.id} value={o.id}>
     {o.reference_code} · v{o.version} · {o.source_section} · {o.title}
    </option>)}
   </select>
  </label>
  <p className="help protocol-full">Registre apenas critérios que possam ser conferidos
   documentalmente. O vínculo guarda a versão histórica, mesmo que surjam novas versões.</p>
  <button type="submit" className="btn btn-primary"
   disabled={busy||!normativeVersionId||criterion.trim().length<10}>
   {busy?'Registrando…':'Adicionar critério pendente'}</button>
  {message&&<p role="status" className="success protocol-full">{message}</p>}
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
 </form>;
}
export function ReviewModalityCheck({projectId,checkId,revision,currentStatus}:{
 projectId:string;checkId:string;revision:number;currentStatus:string
}){
 const router=useRouter();
 const [status,setStatus]=useState(currentStatus);
 const [justification,setJustification]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setMessage('');setError('');
  try{
   const response=await fetch('/api/projects/modality-map/review',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,checkId,expectedRevision:revision,status,justification})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Não foi possível registrar a revisão.');
   setJustification('');setMessage('Revisão registrada no histórico do projeto.');
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Falha de revisão.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void save(e)}>
  <label>Situação informada
   <select value={status} onChange={e=>setStatus(e.target.value)}>
    {REVIEW_STATES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
   </select>
  </label>
  <label className="protocol-full">Justificativa e documentos verificados
   <textarea required rows={3} minLength={10} maxLength={1000}
    value={justification} onChange={e=>setJustification(e.target.value)}
    placeholder="Anote evidências verificadas, limites e pendências."/>
  </label>
  <button type="submit" className="btn btn-outline"
   disabled={busy||justification.trim().length<10}>
   {busy?'Gravando…':'Registrar nova avaliação'}</button>
  {message&&<p role="status" className="success protocol-full">{message}</p>}
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
 </form>;
}
