'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {PROPOSAL_REVIEW_DECISIONS} from '@/lib/proposal-review.mjs';

export function ProposalReviewForm({projectId,draftId,versionId,
 expectedReviewRevision,hasPlaceholders}:{
 projectId:string;draftId:string;versionId:string;
 expectedReviewRevision:number;hasPlaceholders:boolean
}){
 const router=useRouter();
 const [decision,setDecision]=useState<'aprovada'|'devolvida'>('devolvida');
 const [reviewNote,setReviewNote]=useState('');
 const [ack,setAck]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/projects/proposals/reviews',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({
     projectId,draftId,versionId,decision,reviewNote,
     acknowledgedMissingSources:ack,expectedReviewRevision
    })
   });
   const body=await response.json() as {error?:string};
   if(!response.ok)throw new Error(body.error||'Não foi possível registrar a avaliação.');
   setSuccess('Avaliação editorial interna registrada na versão exata.');
   setReviewNote('');setAck(false);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha na avaliação.');}
  finally{setBusy(false);}
 }
 return <form onSubmit={e=>void submit(e)} className="external-protocol-form">
  <label>Decisão de revisão da versão
   <select value={decision} onChange={e=>setDecision(e.target.value as 'aprovada'|'devolvida')}>
    {PROPOSAL_REVIEW_DECISIONS.map(([value,label])=><option key={value}
     value={value} disabled={value==='aprovada'&&hasPlaceholders}>{label}</option>)}
   </select>
  </label>
  <label className="protocol-full">Justificativa documentada
   <textarea rows={3} minLength={15} maxLength={1000} required value={reviewNote}
    onChange={e=>setReviewNote(e.target.value)}
    placeholder="Indique a análise das seções, pendências e correções necessárias."/>
  </label>
  <label className="protocol-full">
   <input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>
   Estou ciente de que fontes, informações e pendências precisam ser
   verificadas separadamente, mesmo após aprovação editorial.
  </label>
  {hasPlaceholders&&<p className="note protocol-full">Esta versão contém
   marcadores de preenchimento. Só é permitido devolvê-la para ajustes.</p>}
  <button type="submit" className="btn btn-primary"
   disabled={busy||reviewNote.trim().length<15||
    (decision==='aprovada'&&(!ack||hasPlaceholders))}>
   {busy?'Registrando…':'Registrar decisão desta versão'}</button>
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
  {success&&<p role="status" className="success protocol-full">{success}</p>}
 </form>;
}
