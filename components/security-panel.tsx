'use client';
import { useEffect,useState,type FormEvent } from 'react';
type SessionInfo={id:string;created_at:string;expires_at:string;is_current:boolean};
export function SecurityPanel(){
  const [sessions,setSessions]=useState<SessionInfo[]>([]);
  const [secret,setSecret]=useState('');
  const [uri,setUri]=useState('');
  const [code,setCode]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  async function load(){
    const r=await fetch('/api/auth/sessions',{cache:'no-store'});
    if(r.ok)setSessions((await r.json()).sessions||[]);
  }
  useEffect(()=>{void load();},[]);
  async function begin(){
    setBusy(true);setStatus('');
    try{
      const r=await fetch('/api/auth/mfa/enroll',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'begin'})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Falha na configuração');
      setSecret(d.secret);setUri(d.otpauth);
    }catch(e){setStatus(e instanceof Error?e.message:'Erro');}finally{setBusy(false);}
  }
  async function confirm(e:FormEvent){
    e.preventDefault();setBusy(true);setStatus('');
    try{
      const r=await fetch('/api/auth/mfa/enroll',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'confirm',code})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Falha na confirmação');
      setSecret('');setUri('');setCode('');setStatus('Autenticação em dois fatores ativada. Demais sessões encerradas.');
      await load();
    }catch(e){setStatus(e instanceof Error?e.message:'Erro');}finally{setBusy(false);}
  }
  async function revokeOthers(){
    setBusy(true);setStatus('');
    try{
      const r=await fetch('/api/auth/sessions',{method:'DELETE'});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha ao revogar');
      setStatus(`${d.revoked} sessão(ões) encerrada(s).`);await load();
    }catch(e){setStatus(e instanceof Error?e.message:'Erro');}finally{setBusy(false);}
  }
  return <div className="grid-panels">
    <section className="panel"><div className="panel-heading"><h3>Aplicativo autenticador (TOTP)</h3></div>
      <p className="help">Proteja seu acesso com um código temporário de seis dígitos. Guarde a chave com segurança: ela só é apresentada nesta etapa.</p>
      {!secret?<button type="button" className="btn btn-primary" disabled={busy} onClick={begin}>Configurar verificação em duas etapas</button>
      :<form className="login-form" onSubmit={confirm}>
        <label>Chave para adicionar ao aplicativo autenticador
          <input type="text" readOnly value={secret} aria-label="Chave de autenticação" /></label>
        <p className="help">No seu aplicativo autenticador, escolha adicionar conta por chave de configuração. Identificador: AXE Fomento.</p>
        <details><summary>Link de configuração (não compartilhe)</summary><code className="help" style={{wordBreak:'break-all'}}>{uri}</code></details>
        <label>Código atual de 6 dígitos
          <input type="text" value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>Ativar MFA</button>
      </form>}
    </section>
    <section className="panel"><div className="panel-heading"><h3>Minhas sessões</h3></div>
      <p className="help">Você pode encerrar outros dispositivos sem interromper o acesso atual.</p>
      <div role="list">{sessions.map(s=><div key={s.id} role="listitem" className="profile-row">
        <span>{s.is_current?'Este dispositivo':'Outra sessão'}</span>
        <strong>{new Date(s.created_at).toLocaleString('pt-BR')}</strong>
      </div>)}</div>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={revokeOthers}>Encerrar outras sessões</button>
    </section>
    {status&&<p role="status" className="note">{status}</p>}
  </div>;
}
