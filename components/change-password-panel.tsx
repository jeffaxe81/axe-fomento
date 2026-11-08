'use client';
import { useState, type FormEvent } from 'react';
export function ChangePasswordPanel(){
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [failed,setFailed]=useState(false);
  async function change(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    setBusy(true);setNotice('');setFailed(false);
    const form=e.currentTarget;
    const data=new FormData(form);
    const currentPassword=String(data.get('currentPassword')||'');
    const newPassword=String(data.get('newPassword')||'');
    if(newPassword!==data.get('confirmation')){
      setNotice('A confirmação da nova senha não corresponde.');setFailed(true);setBusy(false);return;
    }
    try{
      const response=await fetch('/api/auth/change-password',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({currentPassword,newPassword})
      });
      const message=await response.json();
      if(!response.ok)throw new Error(message.error||'Não foi possível alterar a senha');
      form.reset();
      setNotice('Senha atualizada. Todas as outras sessões foram encerradas.');
      window.location.reload();
    }catch(e){
      setFailed(true);setNotice(e instanceof Error?e.message:'Não foi possível alterar a senha');
    }finally{setBusy(false);}
  }
  return <section className="panel wide" style={{marginTop:22}}>
    <div className="panel-heading"><h3>Alterar senha e encerrar os outros dispositivos</h3></div>
    <p className="help">Ao alterar a senha, todas as sessões anteriores são invalidadas e este acesso recebe uma nova sessão.</p>
    <form className="login-form" onSubmit={change}>
      <label>Senha atual<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={512}/></label>
      <label>Nova senha<input type="password" name="newPassword" autoComplete="new-password"
        minLength={12} maxLength={128} required
        aria-describedby="password-requirements"/></label>
      <p id="password-requirements" className="help">Use 12 caracteres ou mais, incluindo letra maiúscula, minúscula, número e símbolo.</p>
      <label>Confirmar nova senha<input type="password" name="confirmation" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Salvando…':'Atualizar senha com segurança'}</button>
      {notice&&<p role="status" className={failed?'error':'success'}>{notice}</p>}
    </form>
  </section>;
}
