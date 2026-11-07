'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';

export type StageOption={id:string;stage_number:number;title:string};
const units=[
 ['un','Unidade'],['m','Metro'],['m2','Metro quadrado'],['m3','Metro cúbico'],
 ['km','Quilômetro'],['kg','Quilograma'],['hora','Hora'],['dia','Dia'],
 ['mes','Mês'],['servico','Serviço']
] as const;

export function BudgetStageForm({projectId}: {projectId:string}){
 const router=useRouter();
 const [stageNumber,setStageNumber]=useState('1'),[title,setTitle]=useState('');
 const [startsOn,setStartsOn]=useState(''),[endsOn,setEndsOn]=useState('');
 const [assumptions,setAssumptions]=useState(''),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/projects/budget/stages',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,stageNumber:Number(stageNumber),title,startsOn,endsOn,assumptions})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Etapa não registrada.');
   setStageNumber(String(Math.min(200,Number(stageNumber)+1)));setTitle('');
   setStartsOn('');setEndsOn('');setAssumptions('');
   setMessage('Etapa registrada. Confira o novo quadro orçamentário.');
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Erro ao registrar etapa.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Número da etapa
   <input required type="number" min={1} max={200} step={1} value={stageNumber}
    onChange={e=>setStageNumber(e.target.value)}/>
  </label>
  <label>Nome da etapa
   <input required minLength={5} maxLength={160} value={title}
    onChange={e=>setTitle(e.target.value)} placeholder="Ex.: projeto executivo"/>
  </label>
  <label>Início previsto
   <input required type="date" min="2000-01-01" max="2100-12-31"
    value={startsOn} onChange={e=>setStartsOn(e.target.value)}/>
  </label>
  <label>Fim previsto
   <input required type="date" min="2000-01-01" max="2100-12-31"
    value={endsOn} onChange={e=>setEndsOn(e.target.value)}/>
  </label>
  <label className="protocol-full">Premissas de execução
   <textarea required rows={2} minLength={10} maxLength={1200} value={assumptions}
    onChange={e=>setAssumptions(e.target.value)}
    placeholder="Fonte interna, escopo, prazos e método de estimativa"/>
  </label>
  <button className="btn btn-primary" disabled={busy||!stageNumber||!title.trim()||
   !startsOn||!endsOn||assumptions.trim().length<10} type="submit">
   {busy?'Registrando…':'Adicionar etapa'}</button>
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
  {message&&<p className="success protocol-full" role="status">{message}</p>}
 </form>;
}

export function BudgetItemForm({projectId,stages}: {projectId:string;stages:StageOption[]}){
 const router=useRouter();
 const [stageId,setStageId]=useState(''),[lineNumber,setLineNumber]=useState('1');
 const [title,setTitle]=useState(''),[unit,setUnit]=useState('un');
 const [quantity,setQuantity]=useState(''),[unitCost,setUnitCost]=useState('');
 const [assumptions,setAssumptions]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/projects/budget/items',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,stageId,lineNumber:Number(lineNumber),title,
     unit,quantity,unitCost,assumptions})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Item não registrado.');
   setLineNumber(String(Math.min(9999,Number(lineNumber)+1)));
   setTitle('');setQuantity('');setUnitCost('');setAssumptions('');
   setMessage('Item gravado; o subtotal da etapa foi recalculado.');
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Erro ao registrar item.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Etapa
   <select required value={stageId} onChange={e=>{setStageId(e.target.value);setLineNumber('1');}}>
    <option value="">Selecione</option>
    {stages.map(s=><option key={s.id} value={s.id}>{s.stage_number} — {s.title}</option>)}
   </select>
  </label>
  <label>Número do item
   <input required type="number" step={1} min={1} max={9999} value={lineNumber}
    onChange={e=>setLineNumber(e.target.value)}/>
  </label>
  <label className="protocol-full">Descrição
   <input required minLength={5} maxLength={160} value={title}
    onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Instalação de equipamento"/>
  </label>
  <label>Unidade
   <select value={unit} onChange={e=>setUnit(e.target.value)}>
    {units.map(([v,label])=><option key={v} value={v}>{label}</option>)}
   </select>
  </label>
  <label>Quantidade (até 3 decimais)
   <input required inputMode="decimal" value={quantity} maxLength={10}
    onChange={e=>setQuantity(e.target.value)} placeholder="2,500"/>
  </label>
  <label>Preço por unidade (R$, até 2 decimais)
   <input required inputMode="decimal" value={unitCost} maxLength={15}
    onChange={e=>setUnitCost(e.target.value)} placeholder="1250,40"/>
  </label>
  <label className="protocol-full">Fonte da cotação e premissas
   <textarea required rows={2} minLength={10} maxLength={1200}
    value={assumptions} onChange={e=>setAssumptions(e.target.value)}
    placeholder="Explique origem, unidade, quantidade, prazo e custo"/>
  </label>
  <p className="help protocol-full">Valores declarados, sem cotação ou validação fiscal automática.
   Item gravado não pode ser editado nesta versão; confira antes de salvar.</p>
  <button className="btn btn-primary" type="submit"
   disabled={busy||!stageId||!lineNumber||title.trim().length<5||
    !quantity||!unitCost||assumptions.trim().length<10}>
   {busy?'Registrando…':'Adicionar item e recalcular'}</button>
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
  {message&&<p className="success protocol-full" role="status">{message}</p>}
 </form>;
}
