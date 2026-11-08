'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';
import {CHECK_LABELS,FINANCIER_AREAS,FINANCIER_MODALITIES,FINANCIER_TYPES}
 from '@/lib/financier-options.mjs';

type Reference={
 referenceUrl:string;referenceTitle:string;referenceSection:string;
 checkStatus:'referencia_informada'|'consultada_internamente'|'revisao_necessaria';
 checkedOn:string;evidenceNote:string;
};
const blank:Reference={referenceUrl:'',referenceTitle:'',referenceSection:'',
 checkStatus:'referencia_informada',checkedOn:'',evidenceNote:''};
function useReference(){
 const [value,setValue]=useState<Reference>(blank);
 return {value,change:(k:keyof Reference,v:string)=>
  setValue(old=>({...old,[k]:v})),reset:()=>setValue(blank)};
}
function ErrorMessage({error,success}:{error:string;success:string}){
 return <>{error&&<p className="error protocol-full" role="alert">{error}</p>}
  {success&&<p className="success protocol-full" role="status">{success}</p>}</>;
}
function ReferenceFields({value,change}:{value:Reference;
 change:(k:keyof Reference,v:string)=>void}){
 return <>
  <label className="protocol-full">URL pública de referência (HTTPS, sem parâmetros)
   <input required type="url" maxLength={500} value={value.referenceUrl}
    onChange={e=>change('referenceUrl',e.target.value)}
    placeholder="https://www.exemplo.gov.br/pagina-institucional"/>
  </label>
  <label>Título da página de referência
   <input required minLength={5} maxLength={180} value={value.referenceTitle}
    onChange={e=>change('referenceTitle',e.target.value)}/>
  </label>
  <label>Seção consultada
   <input required minLength={3} maxLength={120} value={value.referenceSection}
    onChange={e=>change('referenceSection',e.target.value)}
    placeholder="Ex.: Área institucional"/>
  </label>
  <label>Situação da fonte
   <select value={value.checkStatus}
    onChange={e=>change('checkStatus',e.target.value)}>
    {Object.entries(CHECK_LABELS).map(([key,label])=><option key={key}
     value={key}>{label}</option>)}
   </select>
  </label>
  <label>Data da consulta humana (se realizada)
   <input type="date" min="2000-01-01" max="2100-12-31"
    required={value.checkStatus==='consultada_internamente'}
    value={value.checkedOn} onChange={e=>change('checkedOn',e.target.value)}/>
  </label>
  <label className="protocol-full">Registro e observação da equipe
   <textarea required minLength={20} maxLength={1000} rows={4}
    value={value.evidenceNote} onChange={e=>change('evidenceNote',e.target.value)}
    placeholder="Explique o que foi conferido na página, sem afirmar disponibilidade de recursos."/>
  </label>
  <p className="help protocol-full">A fonte e a data são declaradas por um
   responsável da prefeitura. A situação consultada internamente não
   confirma edital aberto, taxas, elegibilidade ou financiamento.</p>
 </>;
}
function MultiCheckboxes({label,options,selected,setSelected}:{label:string;
 options:Record<string,string>;selected:string[];
 setSelected:(next:string[])=>void}){
 return <fieldset className="protocol-full">
  <legend>{label}</legend>
  <div className="small-tags">
   {Object.entries(options).map(([key,text])=><label className="chip" key={key}>
    <input type="checkbox" checked={selected.includes(key)} onChange={e=>{
     setSelected(e.target.checked?[...selected,key]:
      selected.filter(x=>x!==key));
    }}/> {text}
   </label>)}
  </div>
 </fieldset>;
}
export function CreateFinancierForm(){
 const router=useRouter(),{value,change,reset}=useReference();
 const [referenceCode,setCode]=useState(''),[name,setName]=useState('');
 const [institutionType,setType]=useState('agencia_publica');
 const [financingModalities,setModalities]=useState<string[]>([]);
 const [thematicAreas,setAreas]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/financiers',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({referenceCode,name,institutionType,
     financingModalities,thematicAreas,...value,checkedOn:value.checkedOn||null})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Falha ao registrar a instituição.');
   setCode('');setName('');setModalities([]);setAreas([]);reset();
   setSuccess('Instituição e referência inicial cadastradas; informações sujeitas à conferência.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Código interno da instituição
   <input required minLength={3} maxLength={60} value={referenceCode}
    onChange={e=>setCode(e.target.value.toUpperCase())}
    placeholder="CODIGO INTERNO"/>
  </label>
  <label>Nome da instituição
   <input required minLength={5} maxLength={180} value={name}
    onChange={e=>setName(e.target.value)}/>
  </label>
  <label>Categoria da instituição
   <select value={institutionType} onChange={e=>setType(e.target.value)}>
    {Object.entries(FINANCIER_TYPES).map(([key,text])=>
     <option key={key} value={key}>{text}</option>)}
   </select>
  </label>
  <MultiCheckboxes label="Modalidades informadas (selecione ao menos uma)"
   options={FINANCIER_MODALITIES} selected={financingModalities}
   setSelected={setModalities}/>
  <MultiCheckboxes label="Áreas temáticas declaradas (selecione ao menos uma)"
   options={FINANCIER_AREAS} selected={thematicAreas} setSelected={setAreas}/>
  <ReferenceFields value={value} change={change}/>
  <button className="btn btn-primary" type="submit" disabled={busy||
   !financingModalities.length||!thematicAreas.length}>
   {busy?'Registrando…':'Cadastrar instituição e referência'}
  </button>
  <ErrorMessage error={error} success={success}/>
 </form>;
}
export function AddFinancierVersion({financierId,expectedVersion}:{
 financierId:string;expectedVersion:number}){
 const router=useRouter(),{value,change,reset}=useReference();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess('');
  try{
   const response=await fetch('/api/financiers/versions',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({financierId,expectedVersion,...value,
     checkedOn:value.checkedOn||null})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error||'Não foi possível registrar nova conferência.');
   reset();setSuccess('Nova observação versionada; a referência anterior foi preservada.');
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha na atualização.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <p className="help protocol-full">A próxima versão será v{expectedVersion+1}.
   Em conflito entre administradores, a versão antiga será preservada
   e a gravação divergente recusada.</p>
  <ReferenceFields value={value} change={change}/>
  <button className="btn btn-primary" type="submit" disabled={busy}>
   {busy?'Registrando…':'Adicionar observação sem sobrescrever'}
  </button>
  <ErrorMessage error={error} success={success}/>
 </form>;
}
