'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';

export function InvitationAccept(){
  const [code,setCode]=useState('');
  const [name,setName]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');
    if(password!==confirm){setError('A confirmação da senha não corresponde.');return;}
    setBusy(true);
    try{
      const response=await fetch('/api/auth/invite/accept',{
        method:'POST',credentials:'same-origin',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({code:code.trim(),fullName:name,password}),
      });
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error||'Não foi possível aceitar o convite.');
      setSuccess(true);setPassword('');setConfirm('');setCode('');
    }catch(error){setError(error instanceof Error?error.message:'Não foi possível criar a conta.');}
    finally{setBusy(false);}
  }
  if(success)return <div className="login-card">
    <h1>Conta institucional criada</h1>
    <p>O convite foi consumido. Acesse com o e-mail previamente convidado e sua senha.</p>
    <Link href="/login" className="btn btn-primary">Fazer login</Link>
  </div>;
  return <div className="login-card">
    <h1>Aceitar convite</h1>
    <p>O acesso à prefeitura é definido pelo convite, não por esta página. O código só pode ser usado uma vez.</p>
    <form className="login-form" onSubmit={(event)=>void submit(event)}>
      <label>Código de convite
        <input type="text" required maxLength={43} minLength={43} value={code}
          onChange={(e)=>setCode(e.target.value)} autoComplete="off"
          aria-label="Código institucional de uso único" />
      </label>
      <label>Nome completo
        <input type="text" required minLength={3} maxLength={120} value={name}
          onChange={(e)=>setName(e.target.value)} autoComplete="name"/>
      </label>
      <label>Senha de acesso
        <input type="password" required minLength={12} maxLength={128} value={password}
          onChange={(e)=>setPassword(e.target.value)} autoComplete="new-password"/>
      </label>
      <label>Confirmar senha
        <input type="password" required minLength={12} maxLength={128} value={confirm}
          onChange={(e)=>setConfirm(e.target.value)} autoComplete="new-password"/>
      </label>
      <p className="help">Use de 12 a 128 caracteres com letra maiúscula, minúscula, número e símbolo.
        Para segurança, o cadastro não inicia uma sessão automaticamente.</p>
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy?'Criando conta…':'Criar conta institucional'}
      </button>
      <Link href="/login" className="button-link">Voltar ao login</Link>
    </form>
  </div>;
}
