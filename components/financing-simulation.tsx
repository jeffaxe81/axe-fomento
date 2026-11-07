'use client';

import {useId,useState,type FormEvent} from 'react';
import {formatBRLCents,parseBRLToCents} from '@/lib/financial-money.mjs';
import {simulateFinancing,type FinancingScenarioInput,type FinancingSimulationResult} from '@/lib/financing-simulation.mjs';
import styles from './financing-simulation.module.css';

type Scenario='A'|'B';
type Comparison=Record<Scenario,FinancingSimulationResult>;
type Errors=Partial<Record<'principal'|Scenario,string>>;

const emptyInputs:FinancingScenarioInput={monthlyRate:'',amortizationMonths:'',graceMonths:'0'};
const scenarioFields=[
 {key:'monthlyRate',label:'Taxa mensal (%)',mode:'decimal',placeholder:'1,25',
  help:'De 0 a 100 com até quatro casas decimais.'},
 {key:'amortizationMonths',label:'Prazo de amortização (meses)',mode:'numeric',placeholder:'24',
  help:'De 1 a 360 meses inteiros.'},
 {key:'graceMonths',label:'Carência (meses)',mode:'numeric',
  help:'De 0 a 60 meses inteiros. Use 0 se não houver carência.'},
] as const;

function ScenarioFields({scenario,inputs,error,onChange}:{
 scenario:Scenario;inputs:FinancingScenarioInput;error?:string;onChange:(key:keyof FinancingScenarioInput,value:string)=>void;
}){
 const id=useId();
 return <fieldset className={`${styles.scenario} ${scenario==='B'?styles.scenarioB:''}`}
  aria-describedby={error?`${id}-error`:undefined}>
  <legend>Cenário {scenario}</legend>
  {scenarioFields.map(({key,label,mode,help,...options})=><label key={key} htmlFor={`${id}-${key}`}>
   {label}
   <input id={`${id}-${key}`} type="text" inputMode={mode} required value={inputs[key]}
    {...options} aria-describedby={`${id}-${key}-help`}
    onChange={event=>onChange(key,event.target.value)}/>
   <span id={`${id}-${key}-help`} className="help">{help}</span>
  </label>)}
  {error&&<p className="error" id={`${id}-error`} role="alert">{error}</p>}
 </fieldset>;
}

const months=(value:number)=>`${value} ${value===1?'mês':'meses'}`;
const comparisonRows:ReadonlyArray<readonly [string,(result:FinancingSimulationResult)=>string]>=[
 ['Total pago',result=>formatBRLCents(result.totalPaidCents)],
 ['Juros totais',result=>formatBRLCents(result.totalInterestCents)],
 ['Taxa mensal',result=>(result.monthlyRateUnits/10000).toLocaleString('pt-BR',{maximumFractionDigits:4})+'%'],
 ['Amortização',result=>months(result.amortizationMonths)],
 ['Prazo total',result=>months(result.graceMonths+result.amortizationMonths)],
 ['Pagamento mensal na carência',result=>result.gracePaymentCents===null
  ?'Sem carência'
  :`${formatBRLCents(result.gracePaymentCents)} por ${months(result.graceMonths)}`],
 ['Primeira parcela de amortização',result=>formatBRLCents(result.firstAmortizationPaymentCents)],
 ['Última parcela de amortização',result=>formatBRLCents(result.lastAmortizationPaymentCents)],
];

export function FinancingSimulation({budgetTotalCents}:{budgetTotalCents:string}){
 const id=useId();
 const [amount,setAmount]=useState('');
 const [inputs,setInputs]=useState<Record<Scenario,FinancingScenarioInput>>({A:emptyInputs,B:emptyInputs});
 const [errors,setErrors]=useState<Errors>({});
 const [result,setResult]=useState<{comparison:Comparison;budgetCents:string}|null>(null);
 const hasBudget=/^[0-9]{1,24}$/.test(budgetTotalCents)&&/[1-9]/.test(budgetTotalCents);
 const comparison=result?.budgetCents===budgetTotalCents?result.comparison:null;

 function clearResult(){
  setErrors({});
  setResult(null);
 }

 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const override=amount.trim();
  const principal=override?parseBRLToCents(override):hasBudget?budgetTotalCents:null;
  if(!principal||principal==='0'){
   setResult(null);
   setErrors({principal:override
    ?'Informe um valor maior que zero, com até 12 dígitos inteiros e duas casas decimais, sem separador de milhar.'
    :'Informe o valor a financiar para comparar os cenários.'});
   return;
  }

  const calculate=(scenario:Scenario)=>simulateFinancing(principal,{
   monthlyRate:inputs[scenario].monthlyRate.trim(),
   amortizationMonths:inputs[scenario].amortizationMonths.trim(),
   graceMonths:inputs[scenario].graceMonths.trim(),
  });
  const A=calculate('A');
  const B=calculate('B');
  if(A&&B){
   setErrors({});
   setResult({comparison:{A,B},budgetCents:budgetTotalCents});
  }else{
   const error='Confira a taxa mensal e os prazos deste cenário conforme os limites dos campos.';
   setErrors({...(!A?{A:error}:{}),...(!B?{B:error}:{})});
   setResult(null);
  }
 }

 return <section className={`panel ${styles.simulation}`} aria-labelledby={`${id}-title`}>
  <h2 id={`${id}-title`}>Simulação de parcelas</h2>
  <p className="help">Compare dois cenários pelo Sistema de Amortização Constante (SAC),
   com taxa mensal fixa em cada cenário. Durante a carência, o modelo prevê
   pagamentos mensais de juros sobre o principal.</p>
  <p className="help">Os dados da simulação ficam apenas nesta página do navegador.</p>
  <dl className="project-details">
   <div className="profile-row">
    <dt>Total do orçamento do projeto</dt>
    <dd><strong>{formatBRLCents(budgetTotalCents)}</strong></dd>
   </div>
  </dl>
  <form className="external-protocol-form" onSubmit={submit}>
   <label className="protocol-full" htmlFor={`${id}-principal`}>
    Valor a financiar (R$)
    <input id={`${id}-principal`} type="text" inputMode="decimal" placeholder="1200,00" value={amount}
     aria-invalid={errors.principal?true:undefined}
     aria-describedby={`${id}-principal-help${errors.principal?` ${id}-principal-error`:''}`}
     onChange={event=>{setAmount(event.target.value);clearResult();}}/>
    <span className="help" id={`${id}-principal-help`}>
     {hasBudget?'Deixe em branco para usar o total do orçamento do projeto.':'Informe o valor a financiar para comparar os cenários.'}
     {' '}Na entrada manual, use até 12 dígitos inteiros e duas casas decimais, sem separador de milhar.
    </span>
   </label>
   {errors.principal&&<p className="error protocol-full" id={`${id}-principal-error`} role="alert">
    {errors.principal}
   </p>}
   {(['A','B'] as const).map(scenario=><ScenarioFields key={scenario} scenario={scenario}
    inputs={inputs[scenario]} error={errors[scenario]}
    onChange={(key,value)=>{
     setInputs(current=>({...current,[scenario]:{...current[scenario],[key]:value}}));
     clearResult();
    }}/>)}
   <button className="btn btn-primary" type="submit">Comparar cenários</button>
  </form>
  <p className={styles.announcement} role="status">
   {comparison?'Comparação dos cenários calculada.':''}
  </p>
  {comparison&&<div className={styles.results}>
   <h3 id={`${id}-comparison`}>Comparação dos cenários</h3>
   <p>Valor financiado nos dois cenários <strong>{formatBRLCents(comparison.A.principalCents)}</strong></p>
   <div className="table-scroll" role="region" aria-labelledby={`${id}-comparison`} tabIndex={0}>
    <table className={styles.comparison} aria-labelledby={`${id}-comparison`}>
     <thead><tr><th scope="col">Indicador</th><th scope="col">Cenário A</th><th scope="col">Cenário B</th></tr></thead>
     <tbody>
      {comparisonRows.map(([label,display])=><tr key={label}>
       <th scope="row">{label}</th><td>{display(comparison.A)}</td><td>{display(comparison.B)}</td>
      </tr>)}
     </tbody>
    </table>
   </div>
   <details>
    <summary>Memória de cálculo</summary>
    <p className="help">Em cada mês, os juros são o saldo devedor no início do mês
     multiplicado pela taxa mensal. Durante a carência, a parcela é igual aos juros do mês.</p>
    <p className="help">Após a carência, divide-se o principal em centavos pelo número de meses de
     amortização. Se sobrarem centavos da divisão, cada uma das primeiras parcelas amortiza
     um centavo a mais até distribuir a sobra.</p>
    <p className="help">Cada parcela soma amortização e juros. Os juros são arredondados ao centavo
     mais próximo, com meio centavo arredondado para cima. O total pago soma o principal e todos os juros.</p>
   </details>
  </div>}
 </section>;
}
