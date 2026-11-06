'use client';
import {useState,type FormEvent} from 'react';
import {simulateCounterpart} from '@/lib/counterpart-simulation.mjs';
import {formatBRLCents} from '@/lib/financial-money.mjs';

type Props={totalCents:string;itemCount:number;isExample:boolean};
type Result=NonNullable<ReturnType<typeof simulateCounterpart>>;

export function CounterpartSimulation({totalCents,itemCount,isExample}:Props){
 const [percent,setPercent]=useState('');
 const [availableBudget,setAvailableBudget]=useState('');
 const [result,setResult]=useState<Result|null>(null);
 const [error,setError]=useState(false);

 function clearResult(){
  setError(false);
  setResult(null);
 }

 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const next=simulateCounterpart(totalCents,percent,availableBudget);
  setError(next===null);
  setResult(next);
 }

 const rate=result
  ?(result.rateBasisPoints/100).toLocaleString('pt-BR',{maximumFractionDigits:2})
  :'';

 return <section className="panel" aria-labelledby="counterpart-simulation-title">
  <h2 id="counterpart-simulation-title">Simulação de contrapartida</h2>
  <p className="help">Simulação preliminar com os valores informados. Os dados
   da simulação ficam apenas nesta página do navegador.</p>
  {isExample&&<p className="demo-notice">Projeto vinculado a oportunidade fictícia.
   Os valores deste orçamento são de teste.</p>}
  {itemCount===0?<p className="muted">Cadastre itens no orçamento por etapas para
   usar a simulação.</p>:<>
   <dl className="project-details">
    <div className="profile-row"><dt>Total do orçamento usado na simulação</dt>
     <dd><strong>{formatBRLCents(totalCents)}</strong></dd></div>
   </dl>
   <form className="external-protocol-form" onSubmit={submit}>
    <label>Percentual de contrapartida municipal (%)
     <input type="text" inputMode="decimal" required value={percent} placeholder="10,50"
      aria-describedby="counterpart-percent-help"
      onChange={event=>{setPercent(event.target.value);clearResult();}}/>
     <span className="help" id="counterpart-percent-help">De 0 a 100 com até duas
      casas decimais.</span>
    </label>
    <label>Disponível no orçamento municipal (R$)
     <input type="text" inputMode="decimal" required value={availableBudget}
      placeholder="15000,00" aria-describedby="counterpart-available-help"
      onChange={event=>{setAvailableBudget(event.target.value);clearResult();}}/>
     <span className="help" id="counterpart-available-help">Informe um valor a partir
      de zero com até duas casas decimais e sem separador de milhar.</span>
    </label>
    <button className="btn btn-primary" type="submit">Calcular contrapartida</button>
    {error&&<p className="error protocol-full" role="alert">Confira o percentual de
     0 a 100 e o valor disponível em reais sem separador de milhar. Use até duas
     casas decimais em cada campo.</p>}
   </form>
   <div role="status">
    {result&&<>
     <h3>Resultado da simulação</h3>
     <dl className="project-details">
      <div className="profile-row"><dt>Contrapartida municipal estimada</dt>
       <dd>{formatBRLCents(result.municipalCents)}</dd></div>
      <div className="profile-row"><dt>Valor restante do projeto</dt>
       <dd>{formatBRLCents(result.remainingProjectCents)}</dd></div>
      <div className="profile-row"><dt>Disponível no orçamento municipal</dt>
       <dd>{formatBRLCents(result.availableCents)}</dd></div>
      <div className="profile-row"><dt>Falta para cobrir a contrapartida</dt>
       <dd>{formatBRLCents(result.shortageCents)}</dd></div>
      <div className="profile-row"><dt>Sobra após cobrir a contrapartida</dt>
       <dd>{formatBRLCents(result.surplusCents)}</dd></div>
     </dl>
     <p className="help"><strong>Memória de cálculo</strong>{' '}
      {formatBRLCents(result.totalCents)} × {rate}% = {formatBRLCents(result.municipalCents)}.
      O resultado é arredondado para o centavo mais próximo. Meio centavo arredonda para cima.</p>
    </>}
   </div>
  </>}
 </section>;
}
