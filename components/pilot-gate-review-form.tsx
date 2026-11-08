'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
type EvidenceOption={id:string;gate_id:string;result_claimed:string;created_by:string;environment_label:string};
export function PilotGateReviewForm({evidence,enabled}:{
 evidence:EvidenceOption[];enabled:boolean}){
 const router=useRouter(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  const f=new FormData(event.currentTarget),s=(x:string)=>String(f.get(x)??'').trim();
  try{
   const response=await fetch('/api/pilot/reviews',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({evidenceId:s('evidenceId'),decision:s('decision'),
     acceptanceUrl:s('acceptanceUrl')||null,notes:s('notes'),reviewedOn:s('reviewedOn')})});
   const data=await response.json();
   if(!response.ok)throw Error(typeof data?.error==='string'?data.error:'Revisão indisponível');
   setMessage('Revisão interna registrada. Produção continua condicionada ao aceite final.');
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Falha na revisão');}
  finally{setBusy(false);}
 }
 return <form className="filters" onSubmit={e=>void submit(e)}>
  <label>Registro a revisar<select name="evidenceId" required>
   {evidence.map(row=><option key={row.id} value={row.id}>{row.gate_id} ·
    {row.environment_label} · {row.result_claimed} · {row.id.slice(0,8)}</option>)}
  </select></label>
  <label>Decisão<select name="decision"><option value="rejected">Rejeitar evidência</option>
   <option value="accepted">Aceitar internamente com comprovante assinado</option></select></label>
  <label>URL HTTPS do aceite assinado (exigido ao aceitar)<input name="acceptanceUrl"
   type="url" maxLength={500} placeholder="https://.../aceite-assinado"/></label>
  <label>Data da revisão<input name="reviewedOn" type="date" required/></label>
  <label>Justificativa independente<textarea name="notes" required minLength={30}
   maxLength={1500} rows={4}/></label>
  <button className="btn btn-outline" type="submit" disabled={!enabled||busy||!evidence.length}>
   {busy?'Revisando...':'Registrar revisão por outro administrador'}</button>
  <p role="status" className="help">{message||(!enabled?'Revisão desabilitada neste ambiente.':
   'A revisão deve ser feita por outro administrador; autoaprovação é bloqueada no banco.')}</p>
 </form>;
}
