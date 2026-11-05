'use client';
import {useRouter} from 'next/navigation';
import {useState,type FormEvent} from 'react';

type Snapshot={
 classification:string;base_year:number;reference_date:string;official_url:string;source_label:string;
 version:number;recorded_at:string;
};
type HistoryEntry={version:number;classification:string;base_year:number;reference_date:string;full_name:string};
export function CapagPanel({initial,history,canEdit}:{
 initial:Snapshot|null;history:HistoryEntry[];canEdit:boolean;
}){
 const router=useRouter();
 const [classification,setClassification]=useState(initial?.classification||'');
 const [baseYear,setBaseYear]=useState(initial?.base_year||new Date().getFullYear()-1);
 const [referenceDate,setReferenceDate]=useState(initial?.reference_date||'');
 const [officialUrl,setOfficialUrl]=useState(initial?.official_url||
   'https://www.tesourotransparente.gov.br/temas/estados-e-municipios/capacidade-de-pagamento-capag');
 const [sourceLabel,setSourceLabel]=useState(initial?.source_label||'Planilha CAPAG Municípios — Tesouro Transparente');
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState(''),[failed,setFailed]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setFeedback('');setFailed(false);
  try{
   const response=await fetch('/api/municipality/capag',{method:'POST',credentials:'same-origin',
     headers:{'content-type':'application/json'},body:JSON.stringify({
       classification,baseYear,referenceDate,officialUrl,sourceLabel})});
   const data=await response.json() as {error?:string;changed?:boolean};
   if(!response.ok)throw new Error(data.error||'Falha ao registrar referência');
   setFeedback(data.changed?'Referência CAPAG registrada com histórico.':'Nenhuma mudança na referência registrada.');
   router.refresh();
  }catch(error){setFailed(true);setFeedback(error instanceof Error?error.message:'Falha no cadastro');}
  finally{setBusy(false);}
 }
 const stale=initial?Date.now()-Date.parse(initial.reference_date+'T12:00:00Z')>366*86400000:false;
 return <section className="panel wide capag-panel" aria-labelledby="capag-heading">
  <h2 id="capag-heading">CAPAG — capacidade de pagamento</h2>
  <p className="help">A CAPAG pública é uma referência fiscal preliminar; a nota definitiva é avaliada
    pelo Tesouro Nacional no processo específico. Este painel não realiza consulta ou verificação automática.</p>
  {!initial?<p role="status" className="note">Sem CAPAG registrada para este município.
    Consulte a fonte oficial e registre o período e a classificação correspondentes.</p>:
    <div className="capag-summary">
      <strong className="capag-grade">{initial.classification}</strong>
      <div><strong>Registro municipal informado</strong>
       <p>Ano-base: {initial.base_year} · Data da fonte: <time dateTime={initial.reference_date}>{initial.reference_date.split('-').reverse().join('/')}</time>
          · Versão local: {initial.version}</p>
       <p>{stale?'Referência com mais de 366 dias: reconfirmar na fonte oficial.':
           'A data foi informada manualmente; confirme se existe publicação mais recente.'}</p>
       <p>Fonte declarada: {initial.source_label}</p>
       <a target="_blank" rel="noopener noreferrer" href={initial.official_url}>Consultar a fonte oficial indicada ↗</a>
      </div>
    </div>}
  <p className="help">O repositório público do Tesouro apresenta edições e anos-base diferentes.
    A nota do arquivo não garante elegibilidade para financiamento ou garantia da União.</p>
  {canEdit&&<form className="capag-form" onSubmit={(event)=>void submit(event)}>
    <h3>{initial?'Atualizar referência':'Registrar referência manual'}</h3>
    <p className="help">Transcreva a classificação correspondente ao município somente após conferir
      a edição e a fonte. Alterações são versionadas e atribuídas à conta administradora.</p>
    <div className="capag-form-grid">
      <label>Classificação declarada
       <select required value={classification} onChange={(e)=>setClassification(e.target.value)}>
         <option value="" disabled>Selecione uma classificação</option>
         {['A+','A','B+','B','C','D','N.D.'].map(x=><option value={x} key={x}>{x}</option>)}
       </select>
      </label>
      <label>Ano-base
       <input type="number" min={2017} max={2100} required value={baseYear}
         onChange={(e)=>setBaseYear(Number(e.target.value))}/>
      </label>
      <label>Data de referência do arquivo
       <input type="date" min="2018-01-01" max={new Date().toISOString().slice(0,10)}
         required value={referenceDate} onChange={(e)=>setReferenceDate(e.target.value)}/>
      </label>
      <label>Descrição da edição/arquivo
       <input required minLength={5} maxLength={180} value={sourceLabel}
         onChange={(e)=>setSourceLabel(e.target.value)}/>
      </label>
    </div>
    <label>URL da fonte oficial
     <input required type="url" maxLength={600} value={officialUrl}
       onChange={(e)=>setOfficialUrl(e.target.value)}
       placeholder="https://www.tesourotransparente.gov.br/..."/>
    </label>
    <button disabled={busy} className="btn btn-primary" type="submit">
      {busy?'Registrando…':'Salvar referência declarada'}
    </button>
    {feedback&&<p role={failed?'alert':'status'} className={failed?'error':'success'}>{feedback}</p>}
  </form>}
  {history.length>0&&<details className="capag-history">
   <summary>Histórico municipal de referências CAPAG ({history.length} registro(s) mais recentes)</summary>
   <div className="table-scroll" role="region" aria-label="Histórico de referências CAPAG" tabIndex={0}>
    <table><thead><tr><th scope="col">Versão</th><th scope="col">Classificação</th>
      <th scope="col">Ano-base</th><th scope="col">Data do arquivo</th>
      <th scope="col">Responsável</th></tr></thead>
     <tbody>{history.map(x=><tr key={x.version}>
      <td>{x.version}</td><td>{x.classification}</td><td>{x.base_year}</td>
      <td>{x.reference_date.split('-').reverse().join('/')}</td><td>{x.full_name}</td>
     </tr>)}</tbody></table>
   </div>
  </details>}
 </section>;
}
