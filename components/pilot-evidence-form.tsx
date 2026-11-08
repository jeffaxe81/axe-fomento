'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {PILOT_GATES} from '@/lib/pilot-gates.mjs';
export function PilotEvidenceForm({enabled}:{enabled:boolean}){
 const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [gate,setGate]=useState('OP-01');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setMessage('');setBusy(true);
  const data=new FormData(e.currentTarget),text=(key:string)=>String(data.get(key)??'').trim();
  try{
   const response=await fetch('/api/pilot/gates',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({
     gateId:gate,environmentLabel:text('environmentLabel'),
     resultClaimed:text('resultClaimed'),evidenceUrl:text('evidenceUrl'),
     evidenceSha256:text('evidenceSha256')||null,
     performedOn:text('performedOn'),notes:text('notes')
    })});
   const data=await response.json();
   if(!response.ok)throw Error(typeof data?.error==='string'?data.error:'Registro não autorizado');
   setMessage('Evidência declarada registrada. Não houve aprovação para produção.');
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Registro indisponível');}
  finally{setBusy(false);}
 }
 return <form className="filters" onSubmit={e=>void submit(e)}>
  <label>Portão OP<select value={gate} onChange={e=>setGate(e.target.value)}>
   {PILOT_GATES.map(g=><option key={g.id} value={g.id}>{g.id} — {g.title}</option>)}</select></label>
  <label>Ambiente avaliado<input required name="environmentLabel" minLength={5} maxLength={100}
   placeholder="Homologação municipal"/></label>
  <label>Resultado declarado<select name="resultClaimed">
   <option value="blocked">Bloqueado</option><option value="fail">Falhou</option>
   <option value="pass">Passou no teste (requer aceite)</option></select></label>
  <label>Data do teste<input type="date" required name="performedOn"/></label>
  <label>Link HTTPS do registro de evidência<input type="url" required name="evidenceUrl"
   maxLength={500} placeholder="https://.../relatorios/..."/></label>
  <label>SHA-256 da evidência (opcional)<input name="evidenceSha256" maxLength={64}
   pattern="[a-f0-9]{64}"/></label>
  <label>Procedimento, resultado e responsável<textarea required name="notes"
   minLength={30} maxLength={1500} rows={3}/></label>
  <button className="btn btn-primary" type="submit" disabled={!enabled||busy}>
   {busy?'Registrando...':'Registrar evidência sem liberar produção'}</button>
  <p className="help" role="status">{message||(!enabled?
   'Registro de evidências indisponível até habilitação no ambiente de homologação.':
   'Nunca anexe senhas, tokens nem dados pessoais em URLs. Revisão independente é obrigatória.')}</p>
 </form>;
}
