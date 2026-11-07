'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
export function SourceReviewPanel({ id, version }: {id:string;version:number}) {
  const router=useRouter();
  const [justification,setJustification]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  async function review(decision:'approved'|'rejected') {
    setBusy(true);setMessage('');setFailed(false);
    try {
      const response=await fetch('/api/sources/transferegov/review',{
        method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
        body:JSON.stringify({id,version,decision,justification}),
      });
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error || 'Não foi possível registrar a decisão');
      setMessage('Decisão registrada com justificativa.');
      setJustification('');
      router.refresh();
    }catch(error){
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Falha na revisão');
    }finally{setBusy(false);}
  }
  return <section className="panel source-review">
    <h2>Revisão institucional</h2>
    <p>O aceite reconhece a conferência do registro como <strong>programa cadastrado</strong>.
      Ele não publica edital nem confirma janela de candidatura.</p>
    <label htmlFor="source-review-justification">Justificativa da decisão</label>
    <textarea id="source-review-justification" value={justification}
      onChange={(e)=>setJustification(e.target.value)}
      minLength={10} maxLength={1000} rows={3}
      placeholder="Descreva o que foi conferido na documentação da fonte."/>
    <div className="radar-actions">
      <button type="button" className="btn btn-primary"
        disabled={busy || justification.trim().length < 10}
        onClick={()=>review('approved')}>Aprovar registro</button>
      <button type="button" className="btn btn-danger-outline"
        disabled={busy || justification.trim().length < 10}
        onClick={()=>review('rejected')}>Rejeitar registro</button>
    </div>
    {message && <p role={failed?'alert':'status'} className={failed?'error':'success'}>{message}</p>}
  </section>;
}
