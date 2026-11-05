'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
export function SourceSyncButton({ enabled }: { enabled: boolean }) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  async function synchronize() {
    setBusy(true);setFailed(false);setMessage('');
    try {
      const response=await fetch('/api/sources/transferegov/run',{
        method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
      });
      const result=await response.json() as {found?:number;changed?:number;error?:string};
      if(!response.ok)throw new Error(result.error || 'A coleta não foi concluída');
      setMessage('Coleta concluída: '+result.found+' registros conferidos, '+result.changed+' versões novas.');
      router.refresh();
    }catch(error){
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Falha na coleta');
      router.refresh();
    }finally{setBusy(false);}
  }
  return <div className="source-sync">
    <button type="button" className="btn btn-primary" onClick={synchronize}
      disabled={busy || !enabled}>{busy ? 'Consultando fonte…' : 'Consultar fonte oficial'}</button>
    {!enabled && <span className="help">Coleta desabilitada pelo operador neste ambiente.</span>}
    {message && <span role={failed?'alert':'status'} className={failed?'error':'success'}>{message}</span>}
  </div>;
}
