'use client';
import { useState, type FormEvent } from 'react';
export function LoginForm() {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [mfa,setMfa]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');
    const form=new FormData(e.currentTarget);
    try{
      const response=await fetch(mfa?'/api/auth/mfa/verify':'/api/auth/login',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(mfa?{code:form.get('code')}:{email:form.get('email'),password:form.get('password')})
      });
      if(response.status===202){setMfa(true);setBusy(false);return;}
      if(!response.ok){
        const payload=await response.json().catch(()=>({}));
        throw new Error(payload.error||'Credenciais inválidas');
      }
      window.location.assign('/');
    }catch(e){setError(e instanceof Error?e.message:'Falha de autenticação');setBusy(false);}
  }
  return <form onSubmit={submit} className="login-form">
    {!mfa?<><label>E-mail institucional<input type="email" name="email" autoComplete="username" placeholder="usuario@prefeitura.gov.br" required /></label>
    <label>Senha<input type="password" name="password" autoComplete="current-password" minLength={12} placeholder="••••••••••••" required /></label></>
    :<><p className="muted">Informe o código de 6 dígitos do aplicativo autenticador. Ele expira a cada 30 segundos.</p>
    <label>Código de segurança<input type="text" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus /></label></>}
    {error&&<p role="alert" className="error">{error}</p>}
    <button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Validando…':mfa?'Confirmar código →':'Acessar plataforma →'}</button>
    {mfa&&<button type="button" className="button-link" onClick={()=>{setMfa(false);setError('');}}>Voltar ao login</button>}
  </form>;
}
