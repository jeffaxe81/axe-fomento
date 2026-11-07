'use client';
import {useMemo,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {extractRequirementCandidates,MAX_SOURCE_CHARS} from '@/lib/edict-extraction.mjs';

type DocumentVersionOption={id:string;file_name:string;version:number;sha256:string};
export function EdictExtractionForm({projectId,documents}:{
 projectId:string;documents:DocumentVersionOption[]
}){
 const router=useRouter();
 const [documentVersionId,setDocumentVersionId]=useState('');
 const [sourceText,setSourceText]=useState('');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState(''),[error,setError]=useState('');
 const candidates=useMemo(()=>extractRequirementCandidates(sourceText),[sourceText]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setFeedback('');setError('');
  try{
   const res=await fetch('/api/projects/edict-extractions',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,documentVersionId,sourceText,note})
   });
   const body=await res.json() as {error?:string;batchId?:string;candidates?:number};
   if(!res.ok)throw new Error(body.error||'Falha no registro das sugestões.');
   setFeedback('Lote registrado com '+body.candidates+' sugestões, todas aguardando revisão humana.');
   setSourceText('');setNote('');router.refresh();
   if(body.batchId)router.push('/projetos/'+projectId+'/extracao-edital?lote='+body.batchId);
  }catch(err){setError(err instanceof Error?err.message:'Falha no registro.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label className="protocol-full">Versão do anexo de origem
   <select required value={documentVersionId}
    onChange={e=>setDocumentVersionId(e.target.value)}>
    <option value="">Selecione uma versão privada já anexada ao projeto</option>
    {documents.map(d=><option key={d.id} value={d.id}>
     {d.file_name} — versão {d.version} — SHA-256 {d.sha256.slice(0,12)}…
    </option>)}
   </select>
  </label>
  <label className="protocol-full">Texto transcrito ou copiado do edital
   <textarea required rows={10} minLength={20} maxLength={MAX_SOURCE_CHARS}
    value={sourceText} onChange={e=>setSourceText(e.target.value)}
    placeholder={'PÁGINA 3\nO proponente deverá apresentar certidão regular...\nPÁGINA 4\nÉ obrigatório comprovar...'} />
  </label>
  <p className="help protocol-full">Separe os trechos por linhas. Para indicar páginas,
   escreva uma linha isolada como “PÁGINA 3”. Sem marcador, a página aparecerá
   como não informada; o trecho original permanece visível para conferência.</p>
  <label className="protocol-full">Justificativa da análise
   <textarea required rows={2} minLength={10} maxLength={500}
    value={note} onChange={e=>setNote(e.target.value)}
    placeholder="Indique a finalidade e quem conferirá o documento."/>
  </label>
  <div className="protocol-full" aria-live="polite">
   <strong>Prévia: {candidates?.length??0} sugestão(ões) detectada(s)</strong>
   <p className="help">Extração heurística local, baseada em palavras de obrigação
    — não é OCR, modelo de IA generativa nem verificação do PDF anexado.
    Trechos com menos de 15 caracteres são classificados sem evidência.</p>
   {candidates?.slice(0,8).map(c=><p key={c.seq}>
    {c.sourcePage?'Página '+c.sourcePage:'Página não indicada'} ·
    {' '}{c.evidenceState==='missing'?'Evidência ausente · ':''}
    {c.suggestedRequirement}
   </p>)}
   {(candidates?.length??0)>8&&<p>Há mais sugestões a conferir após o registro.</p>}
  </div>
  <button className="btn btn-primary" type="submit"
   disabled={busy||!documentVersionId||!(candidates?.length)}>
   {busy?'Registrando…':'Registrar sugestões para revisão'}</button>
  {feedback&&<p role="status" className="success protocol-full">{feedback}</p>}
  {error&&<p role="alert" className="error protocol-full">{error}</p>}
 </form>;
}

export function EdictSuggestionReview({projectId,suggestionId,currentRevision,decision,evidencePresent}:{
 projectId:string;suggestionId:string;currentRevision:number;
 decision:string|null;evidencePresent:boolean
}){
 const router=useRouter();
 const [chosen,setChosen]=useState(decision??'pendente');
 const [reviewNote,setReviewNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setMessage('');setError('');
  try{
   const response=await fetch('/api/projects/edict-extractions/reviews',{
    method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,suggestionId,expectedRevision:currentRevision,
     decision:chosen,reviewNote})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'Não foi possível avaliar.');
   setReviewNote('');setMessage('Revisão humana registrada no histórico, sem publicação automática.');
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Falha na revisão.');}
  finally{setBusy(false);}
 }
 return <form className="external-protocol-form" onSubmit={e=>void submit(e)}>
  <label>Decisão do revisor
   <select value={chosen} onChange={e=>setChosen(e.target.value)}>
    <option value="pendente">Manter pendente</option>
    <option value="aprovada" disabled={!evidencePresent}>Aprovar sugestão internamente</option>
    <option value="rejeitada">Rejeitar sugestão</option>
   </select>
  </label>
  <label className="protocol-full">Justificativa documentada
   <textarea required minLength={10} maxLength={1000} rows={2}
    value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
    placeholder="Informe a verificação feita no texto do edital original."/>
  </label>
  <button className="btn btn-outline" type="submit"
   disabled={busy||reviewNote.trim().length<10||(!evidencePresent&&chosen==='aprovada')}>
   {busy?'Registrando…':'Gravar revisão'}</button>
  {error&&<p className="error protocol-full" role="alert">{error}</p>}
  {message&&<p className="success protocol-full" role="status">{message}</p>}
 </form>;
}
