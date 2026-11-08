'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
type Option={id:string;title:string;documentUrl:string};
export function NoticeReviewForm({enabled,options}:{enabled:boolean;options:Option[]}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [observation,setObservation]=useState(options[0]?.id??'');
 const [reviewState,setReviewState]=useState('insufficient_evidence');
 const selected=options.find(x=>x.id===observation);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  const data=new FormData(event.currentTarget);
  const read=(key:string)=>String(data.get(key)??'').trim();
  try{
   const response=await fetch('/api/funding/notice-reviews',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({
     observationId:observation,reviewState,
     eligibilityState:read('eligibilityState'),officialDocumentUrl:selected?.documentUrl??'',
     reviewedOn:read('reviewedOn'),reason:read('reason'),
     requirementsNote:read('requirementsNote')
    })});
   const result=await response.json();
   if(!response.ok)throw Error(result?.reason??result?.error??'Revisão indisponível');
   setMessage('Parecer humano registrado e auditável. Nenhum edital foi certificado automaticamente.');
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Falha ao registrar parecer');}
  finally{setBusy(false);}
 }
 return <form className="filters" onSubmit={e=>void submit(e)}>
  <label>Oportunidade a revisar
   <select required value={observation} onChange={e=>setObservation(e.target.value)}>
    {options.map(o=><option value={o.id} key={o.id}>{o.title}</option>)}
   </select>
  </label>
  <p className="help">Documento oficial declarado: {selected?
   <a href={selected.documentUrl} target="_blank" rel="noopener noreferrer">Abrir fonte primária</a>:
   'Não há edital elegível para segunda revisão nesta conta.'}</p>
  <label>Conclusão da conferência
   <select value={reviewState} onChange={e=>setReviewState(e.target.value)}>
    <option value="insufficient_evidence">Evidência insuficiente</option>
    <option value="rejected_by_reviewer">Edital ou termos incompatíveis</option>
    <option value="confirmed_by_reviewer">Conferência municipal positiva (não certificada)</option>
   </select>
  </label>
  <label>Elegibilidade municipal preliminar
   <select name="eligibilityState" defaultValue="undetermined">
    {reviewState==='confirmed_by_reviewer'&&<option value="potential">Potencial, sujeita às regras oficiais</option>}
    <option value="undetermined">Indeterminada</option>
    <option value="possible_impediment">Possível impedimento</option>
   </select>
  </label>
  <label>Data da revisão<input required name="reviewedOn" type="date"/></label>
  <label>Justificativa com referência à publicação oficial
   <textarea required name="reason" rows={4} minLength={60} maxLength={1500}/></label>
  <label>Critérios de população, área, contrapartida e documentação
   <textarea required name="requirementsNote" rows={4} minLength={40} maxLength={1500}/></label>
  <button type="submit" className="btn btn-outline" disabled={!enabled||busy||!observation}>
   {busy?'Registrando...':'Registrar parecer de segundo administrador'}
  </button>
  <p className="help" role="status">{message||(!enabled?
   'Revisão documental indisponível enquanto a homologação não estiver habilitada.':
   'O autor original não pode aprovar a própria observação. Não há aprovação automática de financiador.')}</p>
 </form>;
}
