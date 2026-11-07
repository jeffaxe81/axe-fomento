'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
type Project={id:string;title:string};
type Observation={id:string;title:string;source:string;external_code:string};
type FundingFormProps={enabled:boolean};
const SOURCE_URLS:Record<string,string>={
 transferegov:'https://api-publica.transferegov.gestao.gov.br/parcerias/programa',
 bndes:'https://cidades.bndes.gov.br/',
 tesouro_capag:'https://www.tesourotransparente.gov.br/temas/estados-e-municipios/capacidade-de-pagamento-capag',
 other_official:'https://www.gov.br/'
};
function errorFrom(x:unknown){
 return typeof x==='object'&&x!==null&&'error' in x&&typeof x.error==='string'?x.error:'Operação não concluída';
}
export function FundingSourceImport({enabled}:FundingFormProps){
 const router=useRouter();const [busy,setBusy]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 async function submit(source:string){
  setBusy(source);setMessage('');
  try{
   const r=await fetch('/api/funding/sources',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({source})});
   const data=await r.json();
   if(!r.ok)throw Error(errorFrom(data));
   setMessage('Referências lidas: '+data.observed+'; novas observações: '+data.added+
    '. Não confirmam abertura de edital nem crédito disponível.');
   router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Falha na importação');}
  finally{setBusy(null);}
 }
 return <div><div className="radar-actions">
  {(['transferegov','bndes','tesouro_capag'] as const).map(source=>
   <button key={source} type="button" className="btn btn-outline"
    disabled={!enabled||busy!==null} onClick={()=>void submit(source)}>
    {busy===source?'Consultando...':source==='tesouro_capag'?'Referência CAPAG':
     source==='bndes'?'Catálogo BNDES':'Programas Transferegov'}
   </button>)}
  </div><p className="help" role="status">{message||(!enabled?
   'Importação bloqueada até homologação das fontes.':'Dados públicos exigem conferência humana.')}</p></div>;
}
export function FundingObservationForm({enabled}:FundingFormProps){
 const router=useRouter();const [source,setSource]=useState('bndes');
 const [url,setUrl]=useState(SOURCE_URLS.bndes);
 const [kind,setKind]=useState('linha_referenciada');
 const [status,setStatus]=useState('nao_confirmada');
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setMessage('');
  const str=(name:string)=>String(form.get(name)||'').trim();
  try{
   const body={source,sourceUrl:url,externalCode:str('externalCode'),title:str('title'),
    modality:str('modality'),observationKind:kind,referenceStatus:status,
    opensOn:str('opensOn')||null,closesOn:str('closesOn')||null,
    checkedOn:str('checkedOn')||null,evidenceNote:str('evidenceNote'),
    terms:{...(str('annualRateBps')?{annualRateBps:Number(str('annualRateBps'))}:{}),
     ...(str('termMonths')?{termMonths:Number(str('termMonths'))}:{}),
     ...(str('minimumPopulation')?{minimumPopulation:Number(str('minimumPopulation'))}:{}),
     ...(str('thematicAreas')?{thematicAreas:str('thematicAreas').split(',').map(s=>s.trim()).filter(Boolean)}:{}),
     ...(kind==='oportunidade_conferida'?{noticeEvidence:{
      noticeIdentifier:str('noticeIdentifier'),noticeUrl:str('noticeUrl'),
      issuingAgency:str('issuingAgency'),publicationDate:str('publicationDate')
     }}:{})}};
   const r=await fetch('/api/funding/observations',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const result=await r.json();if(!r.ok)throw Error(errorFrom(result));
   setMessage('Observação registrada. Consulte a origem antes de utilizar as condições.');
   router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Erro ao registrar fonte');}
  finally{setBusy(false);}
 }
 return <form onSubmit={e=>void save(e)} className="filters">
  <label>Origem
   <select value={source} onChange={e=>{setSource(e.target.value);setUrl(SOURCE_URLS[e.target.value]??'')}}>
    <option value="transferegov">Transferegov</option>
    <option value="bndes">BNDES</option>
    <option value="tesouro_capag">Tesouro / CAPAG</option>
    <option value="other_official">Outro portal .gov.br</option>
   </select>
  </label>
  <label>Código de referência <input name="externalCode" minLength={2} maxLength={100} required/></label>
  <label>Descrição da oportunidade <input name="title" minLength={6} maxLength={220} required/></label>
  <label>Link oficial HTTPS <input value={url} onChange={e=>setUrl(e.target.value)} type="url" required maxLength={500}/></label>
  <label>Modalidade
   <select name="modality" defaultValue="credito">
    <option value="credito">Financiamento / crédito</option>
    <option value="transferencia">Transferência</option>
    <option value="convenio">Convênio</option>
    <option value="cooperacao">Cooperação</option>
    <option value="outro">Outro</option>
   </select></label>
  <label>Tipo do registro <select value={kind} onChange={e=>setKind(e.target.value)}>
   <option value="linha_referenciada">Linha/referência a conferir</option>
   <option value="programa_observado">Programa observado (não é edital)</option>
   <option value="capag_publicacao">Publicação CAPAG</option>
   <option value="oportunidade_conferida">Oportunidade conferida por responsável</option>
  </select></label>
  <label>Conferência <select value={status} onChange={e=>setStatus(e.target.value)}>
   <option value="nao_confirmada">Ainda não confirmada</option>
   <option value="conferida_por_operador">Conferida por operador</option>
   <option value="atualizacao_necessaria">Atualização necessária</option>
  </select></label>
  <label>Data de início <input name="opensOn" type="date"/></label>
  <label>Data final <input name="closesOn" type="date"/></label>
  <label>Data da conferência humana <input name="checkedOn" type="date"/></label>
  <label>Taxa anual informada (pontos base, 100 = 1%) <input name="annualRateBps" type="number" min={0} max={10000}/></label>
  <label>Prazo informado em meses <input name="termMonths" type="number" min={1} max={600}/></label>
  <label>População mínima informada <input name="minimumPopulation" type="number" min={0}/></label>
  <label>Áreas temáticas separadas por vírgula <input name="thematicAreas" maxLength={300}
   placeholder="saneamento, saude"/></label>
  {kind==='oportunidade_conferida'&&<fieldset>
   <legend>Comprovação documental do edital individual</legend>
   <p className="help">Informe o documento primário oficial. Este formulário não consulta
    nem certifica automaticamente a vigência; a conferência é declarada por você.</p>
   <label>Número/identificador do edital <input name="noticeIdentifier" required
    minLength={4} maxLength={120}/></label>
   <label>Órgão emissor <input name="issuingAgency" required minLength={5} maxLength={180}/></label>
   <label>URL direta do edital ou publicação oficial <input name="noticeUrl" required
    type="url" maxLength={500} placeholder="https://www.gov.br/.../edital..."/></label>
   <label>Data da publicação oficial <input name="publicationDate" required type="date"/></label>
  </fieldset>}
  <label>Justificativa / evidência <textarea name="evidenceNote" minLength={15} maxLength={1500} required
   placeholder="Fonte e item do edital/linha que fundamentam a conferência"/></label>
  <button className="btn btn-primary" type="submit" disabled={!enabled||busy}>
   {busy?'Registrando...':'Salvar observação de fonte'}</button>
  <p className="help" role="status">{message}</p>
 </form>;
}
export function FundingCaseForm({enabled,projects,observations}:FundingFormProps&{
 projects:Project[];observations:Observation[]}){
 const router=useRouter();const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');const form=new FormData(event.currentTarget);
  try{
   const r=await fetch('/api/funding/cases',{method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId:form.get('projectId'),observationId:form.get('observationId')})});
   const data=await r.json();if(!r.ok)throw Error(errorFrom(data));
   router.push('/captacao/'+data.id);router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Erro ao vincular projeto');}
  finally{setBusy(false);}
 }
 return <form className="filters" onSubmit={e=>void save(e)}>
  <label>Projeto municipal
   <select name="projectId" required>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select>
  </label>
  <label>Referência de financiamento
   <select name="observationId" required>{observations.map(o=><option key={o.id} value={o.id}>
    {o.source}: {o.title}</option>)}</select>
  </label>
  <button className="btn btn-primary" disabled={!enabled||busy||!projects.length||!observations.length}>
   {busy?'Vinculando...':'Iniciar preparação da candidatura'}</button>
  <p className="help" role="status">{message}</p>
 </form>;
}
export function FundingAlertForm({enabled}:FundingFormProps){
 const router=useRouter();const [message,setMessage]=useState('');
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setMessage('');const form=new FormData(event.currentTarget);
  try{
   const r=await fetch('/api/funding/alerts',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({
     modality:form.get('modality'),daysAhead:Number(form.get('daysAhead')),
     active:form.get('active')==='on'
    })});
   const data=await r.json();if(!r.ok)throw Error(errorFrom(data));
   setMessage('Preferência registrada. Os alertas aparecem na tela, sem envio automático.');
   router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Erro ao registrar alerta');}
 }
 return <form onSubmit={e=>void save(e)} className="filters">
  <label>Modalidade
   <select name="modality"><option value="todas">Todas</option>
    <option value="credito">Crédito</option><option value="convenio">Convênio</option>
    <option value="transferencia">Transferência</option><option value="cooperacao">Cooperação</option>
    <option value="outro">Outra</option></select>
  </label>
  <label>Antecedência <select name="daysAhead">
   <option value="7">7 dias</option><option value="30">30 dias</option>
   <option value="90">90 dias</option></select></label>
  <label><input name="active" type="checkbox" defaultChecked/> Ativo</label>
  <button className="btn btn-primary" disabled={!enabled}>Salvar alerta de tela</button>
  <p className="help" role="status">{message}</p>
 </form>;
}
export function FundingCaseEventForm({enabled,caseId,expectedRevision}:FundingFormProps&{
 caseId:string;expectedRevision:number}){
 const router=useRouter();const [kind,setKind]=useState('eligibility');
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');const form=new FormData(event.currentTarget);
  const value=(name:string)=>String(form.get(name)||'').trim();
  try{
   const r=await fetch('/api/funding/events',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({
     caseId,expectedRevision,eventKind:kind,note:value('note'),
     evidenceUrl:value('evidenceUrl')||null,eventDate:value('eventDate')||null,
     value:value('amount')||null,content:{reference:value('reference')||null}
    })});
   const data=await r.json();if(!r.ok)throw Error(errorFrom(data));
   setMessage('Histórico atualizado. É um registro municipal, não confirmação automática do financiador.');
   router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Erro ao registrar etapa');}
  finally{setBusy(false);}
 }
 return <form onSubmit={e=>void save(e)} className="filters">
  <label>Etapa da captação
   <select value={kind} onChange={e=>setKind(e.target.value)}>
    <option value="eligibility">AF-056 — Análise de enquadramento</option>
    <option value="line_comparison">AF-057 — Comparação das linhas</option>
    <option value="financial_simulation">AF-058 — Premissas da simulação</option>
    <option value="documentation_check">AF-059 — Validação do dossiê documental</option>
    <option value="dossier">AF-060 — Revisão do dossiê</option>
    <option value="submission_handoff">AF-061 — Encaminhamento assistido</option>
    <option value="protocol_update">AF-062 — Protocolo ou situação externa</option>
    <option value="diligence_alert">AF-063 — Diligência com prazo</option>
    <option value="award_verification">AF-064 — Aprovação informada com evidência</option>
    <option value="disbursement_verification">AF-064 — Desembolso informado com evidência</option>
    <option value="decision_review">AF-065 — Revisão de resultado</option>
   </select></label>
  <label>Descrição, parecer ou ação necessária
   <textarea name="note" rows={4} minLength={15} maxLength={1500} required/></label>
  <label>Referência de sistema / número do protocolo
   <input name="reference" maxLength={160}/></label>
  <label>Link de evidência institucional HTTPS (quando aplicável)
   <input name="evidenceUrl" type="url" maxLength={500}
    placeholder="https://...gov.br/..."/></label>
  <label>Data da etapa / vencimento
   <input name="eventDate" type="date"/></label>
  <label>Valor em R$ (ex.: 100000.00), quando aplicável
   <input name="amount" placeholder="100000.00" pattern="[0-9]{1,12}[.][0-9]{2}"/></label>
  <button className="btn btn-primary" disabled={!enabled||busy}>
   {busy?'Salvando...':'Registrar etapa com histórico imutável'}</button>
  <p className="help" role="status">{message}</p>
 </form>;
}
export function FundingSimulationForm(){
 const [amount,setAmount]=useState('100000.00'),[bps,setBps]=useState(1000);
 const [months,setMonths]=useState(120),[grace,setGrace]=useState(0);
 const [result,setResult]=useState<{installmentCents:string;totalCents:string;assumption:string}|null>(null);
 const [message,setMessage]=useState('');
 async function preview(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setMessage('');
  try{
   const r=await fetch('/api/funding/simulate',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({
     principal:amount,annualRateBps:bps,months,graceMonths:grace
    })});
   const data=await r.json();if(!r.ok)throw Error(errorFrom(data));
   setResult(data.scenario);
  }catch(e){setResult(null);setMessage(e instanceof Error?e.message:'Erro na simulação');}
 }
 const money=(v:string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
  .format(Number(v)/100);
 return <form onSubmit={e=>void preview(e)} className="filters">
  <label>Principal (R$) <input value={amount} onChange={e=>setAmount(e.target.value)}
   pattern="[0-9]{1,12}[.][0-9]{2}" required/></label>
  <label>Taxa anual em pontos base (100 = 1%)
   <input type="number" min={0} max={10000} value={bps}
    onChange={e=>setBps(Number(e.target.value))}/></label>
  <label>Parcelas mensais <input type="number" min={1} max={600}
   value={months} onChange={e=>setMonths(Number(e.target.value))}/></label>
  <label>Carência (meses) <input type="number" min={0} max={120}
   value={grace} onChange={e=>setGrace(Number(e.target.value))}/></label>
  <button className="btn btn-outline">Simular parcelas (sem gravar)</button>
  {result&&<p role="status"><strong>Parcela estimada: {money(result.installmentCents)}</strong>.
   Total estimado: {money(result.totalCents)}. {result.assumption}</p>}
  {message&&<p role="alert">{message}</p>}
 </form>;
}
