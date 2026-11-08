'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function SourceContractCheck({enabled}:{enabled:boolean}){
 const router=useRouter();
 const [checking,setChecking]=useState<string|null>(null),[status,setStatus]=useState('');
 async function execute(source:'parcerias'|'discricionarias'){
  setChecking(source);setStatus('');
  try{
   const r=await fetch('/api/sources/contracts',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({source})});
   const data=await r.json();
   if(!r.ok)throw Error(typeof data?.error==='string'?data.error:'Consulta indisponível');
   setStatus('Contrato '+source+': '+data.documentedRoutes+
    ' rotas GET documentadas; nenhuma oportunidade publicada automaticamente.');
   router.refresh();
  }catch(error){setStatus(error instanceof Error?error.message:'Falha de consulta');}
  finally{setChecking(null);}
 }
 return <div className="filters">
  <button type="button" className="btn btn-outline" disabled={!enabled||checking!==null}
   onClick={()=>void execute('parcerias')}>
   {checking==='parcerias'?'Conferindo contrato...':'Conferir API Gestão de Parcerias'}</button>
  <button type="button" className="btn btn-outline" disabled={!enabled||checking!==null}
   onClick={()=>void execute('discricionarias')}>
   {checking==='discricionarias'?'Conferindo contrato...':'Conferir API Discricionárias e Legais'}</button>
  <p role="status" className="help">{status||(!enabled?
   'Consulta externa desabilitada até liberação no ambiente de homologação.':
   'A verificação analisa a documentação de rotas, não a vigência de editais.')}</p>
 </div>;
}
