'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';

type NormativeValues={
 sourceUrl:string;publishedOn:string;validFrom:string;validUntil:string;
 sourceSection:string;excerpt:string;contextNote:string;
};
const blank:NormativeValues={
 sourceUrl:'',publishedOn:'',validFrom:'',validUntil:'',
 sourceSection:'',excerpt:'',contextNote:'',
};
function Fields({values,change}:{
 values:NormativeValues;change:(key:keyof NormativeValues,v:string)=>void;
}){
 return <>
  <label className="protocol-full">Fonte pública HTTPS (sem parâmetros de consulta)
   <input required type="url" maxLength={500} placeholder="https://www.gov.br/..."
    value={values.sourceUrl} onChange={e=>change('sourceUrl',e.target.value)}/>
  </label>
  <label>Publicação informada
   <input required type="date" min="2000-01-01" max="2100-12-31"
    value={values.publishedOn} onChange={e=>change('publishedOn',e.target.value)}/>
  </label>
  <label>Início de vigência informado
   <input required type="date" min="2000-01-01" max="2100-12-31"
    value={values.validFrom} onChange={e=>change('validFrom',e.target.value)}/>
  </label>
  <label>Fim de vigência informado (opcional)
   <input type="date" min="2000-01-01" max="2100-12-31"
    value={values.validUntil} onChange={e=>change('validUntil',e.target.value)}/>
  </label>
  <label>Seção/artigo
   <input required minLength={2} maxLength={120}
    value={values.sourceSection} onChange={e=>change('sourceSection',e.target.value)}
    placeholder="Ex.: art. 3º"/>
  </label>
  <label className="protocol-full">Trecho ou referência examinada
   <textarea required rows={3} minLength={10} maxLength={1200}
    value={values.excerpt} onChange={e=>change('excerpt',e.target.value)}
    placeholder="Registrar trecho conferido pela equipe; não é parecer jurídico."/>
  </label>
  <label className="protocol-full">Justificativa da inclusão ou revisão
   <textarea required rows={3} minLength={10} maxLength={1000}
    value={values.contextNote} onChange={e=>change('contextNote',e.target.value)}
    placeholder="Informe a fonte e a razão para registrar esta versão."/>
  </label>
 </>;
}
function useNormativeFields(){
 const [values,setValues]=useState<NormativeValues>(blank);
 function change(key:keyof NormativeValues,value:string){
  setValues(current=>({...current,[key]:value}));
 }
 return {values,change,reset:()=>setValues(blank)};
}
function statusError(value:unknown){return typeof value==='object'&&value!==null&&
 'error' in value&&typeof value.error==='string'?value.error:'Não foi possível registrar a referência';}
export function CreateNormativeSource(){
 const router=useRouter(),{values,change,reset}=useNormativeFields();
 const [referenceCode,setReferenceCode]=useState(''),[title,setTitle]=useState('');
 const [jurisdiction,setJurisdiction]=useState<'federal'|'estadual'|'municipal'>('federal');
 const [stateUf,setStateUf]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/normativos',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({referenceCode,title,jurisdiction,
     stateUf:jurisdiction==='estadual'?stateUf:'',
     ...values,validUntil:values.validUntil||null})
   });
   const result:unknown=await response.json();
   if(!response.ok)throw new Error(statusError(result));
   setReferenceCode('');setTitle('');setStateUf('');reset();
   setMessage('Referência e primeira versão registradas.');router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Erro de registro.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Código normativo
   <input required minLength={3} maxLength={100} value={referenceCode}
    onChange={e=>setReferenceCode(e.target.value.toUpperCase())}
    placeholder="LEI 123/2026"/>
  </label>
  <label>Título da referência
   <input required minLength={5} maxLength={180} value={title}
    onChange={e=>setTitle(e.target.value)}/>
  </label>
  <label>Jurisdição
   <select value={jurisdiction}
    onChange={e=>setJurisdiction(e.target.value as 'federal'|'estadual'|'municipal')}>
    <option value="federal">Federal</option>
    <option value="estadual">Estadual</option>
    <option value="municipal">Municipal (município ativo)</option>
   </select>
  </label>
  {jurisdiction==='estadual'&&<label>UF estadual
   <input required minLength={2} maxLength={2} value={stateUf}
    onChange={e=>setStateUf(e.target.value.toUpperCase())} placeholder="SC"/>
  </label>}
  <Fields values={values} change={change}/>
  <p className="help protocol-full">Cadastro manual e não verificado.
   A equipe deve conferir a autenticidade, aplicabilidade e vigência da norma
   na publicação original.</p>
  <button className="btn btn-primary" type="submit" disabled={busy}>
   {busy?'Registrando…':'Registrar referência e versão 1'}</button>
  {message&&<p className="success protocol-full" role="status">{message}</p>}
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
 </form>;
}
export function AddNormativeVersion({sourceId,latestVersion}:{
 sourceId:string;latestVersion:number;
}){
 const router=useRouter(),{values,change,reset}=useNormativeFields();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/normativos/versions',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({sourceId,expectedVersion:latestVersion,
     ...values,validUntil:values.validUntil||null})
   });
   const result:unknown=await response.json();
   if(!response.ok)throw new Error(statusError(result));
   reset();setMessage('Nova versão histórica registrada sem alterar as anteriores.');
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Erro de registro.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <p className="help protocol-full">A próxima versão será v{latestVersion+1}.
   Se outra pessoa publicar antes, a gravação será rejeitada por conflito,
   preservando os registros anteriores.</p>
  <Fields values={values} change={change}/>
  <button className="btn btn-primary" type="submit" disabled={busy}>
   {busy?'Registrando…':'Adicionar versão sem sobrescrever'}</button>
  {message&&<p className="success protocol-full" role="status">{message}</p>}
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
 </form>;
}
