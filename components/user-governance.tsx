'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type UserRow = {id:string;full_name:string;email:string;role:'admin'|'analyst';active:boolean};
type Invitation = {id:string;email:string;role:string;issued_at:string;expires_at:string;status:string};

export function UserGovernance({ users, invites, currentUserId }: {
  users: UserRow[]; invites: Invitation[]; currentUserId: string;
}) {
  const router=useRouter();
  const [email,setEmail]=useState('');
  const [role,setRole]=useState<'admin'|'analyst'>('analyst');
  const [code,setCode]=useState('');
  const [expires,setExpires]=useState('');
  const [pendingDeactivation,setPendingDeactivation]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [failed,setFailed]=useState(false);

  async function execute(task:()=>Promise<void>) {
    if(busy)return;
    setBusy(true);setFeedback('');setFailed(false);
    try{await task();}
    catch(error){setFailed(true);setFeedback(error instanceof Error?error.message:'Operação não concluída.');}
    finally{setBusy(false);}
  }
  async function requestJson(url:string,method:'POST'|'PATCH',payload:object){
    const response=await fetch(url,{method,credentials:'same-origin',
      headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const result=await response.json() as {error?:string;code?:string;expiresAt?:string};
    if(!response.ok)throw new Error(result.error||'Não foi possível concluir.');
    return result;
  }
  function invite(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    void execute(async()=>{
      setCode('');setExpires('');
      const result=await requestJson('/api/admin/invitations','POST',{email,role});
      setCode(result.code||'');setExpires(result.expiresAt||'');
      setFeedback('Convite criado. Compartilhe o código diretamente com a pessoa convidada.');
      setEmail('');setRole('analyst');
      router.refresh();
    });
  }
  function changeStatus(id:string,active:boolean){
    void execute(async()=>{
      await requestJson('/api/admin/users/status','PATCH',{userId:id,active});
      setPendingDeactivation(null);
      setFeedback(active?'Conta reativada; é necessário novo login.':'Conta desativada; sessões existentes revogadas.');
      router.refresh();
    });
  }
  return <div className="governance-panels">
    <section className="panel">
      <h2>Emitir convite institucional</h2>
      <p className="help">O código será exibido apenas nesta tela, após a emissão. O convidado cria a própria senha;
        não há envio automático por e-mail. Compartilhe o código em canal seguro.</p>
      <form className="governance-form" onSubmit={invite}>
        <label>E-mail institucional do convidado
          <input type="email" required maxLength={254} autoComplete="off"
            value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="usuario@municipio.gov.br" />
        </label>
        <label>Função atribuída
          <select value={role} onChange={(e)=>setRole(e.target.value as 'admin'|'analyst')}>
            <option value="analyst">Analista — consulta e acompanhamento</option>
            <option value="admin">Administrador municipal — gestão de acesso</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>Gerar convite de 48 horas</button>
      </form>
      {code&&<div className="governance-secret" aria-label="Código de convite de uso único">
        <p><strong>Código de uso único (48 horas).</strong> Não será recuperável nesta interface.</p>
        <code>{code}</code>
        <p className="help">Acesse <strong>/convite</strong> na mesma instalação do AXE Fomento
          e informe o código, nome e senha. Após o registro, o usuário deverá fazer login.</p>
        <button className="btn btn-outline" type="button"
          onClick={() => void navigator.clipboard.writeText(code)}>Copiar código</button>
        {expires&&<small>Expira em {new Date(expires).toLocaleString('pt-BR')}</small>}
        <button className="btn btn-light" type="button" onClick={()=>{setCode('');setExpires('');}}>Ocultar código</button>
      </div>}
      {feedback&&<p className={failed?'error':'success'} role={failed?'alert':'status'}>{feedback}</p>}
    </section>

    <section className="panel">
      <h2>Contas municipais</h2>
      <p className="help">Desativar revoga todas as sessões, inclusive as pendentes de MFA. Não é permitido desativar
        a própria conta autenticada ou o último administrador ativo.</p>
      <div className="governance-rows">
        {users.map((user)=><div className="governance-user" key={user.id}>
          <div className="governance-user-info">
            <strong>{user.full_name}</strong>
            <span>{user.email}</span>
            <small>{user.role==='admin'?'Administrador':'Analista'} · {user.active?'Ativo':'Desativado'}</small>
          </div>
          {user.id===currentUserId?<small>Esta conta</small>:user.active?<>
            {pendingDeactivation===user.id?
              <div className="governance-confirm">
                <span>Confirmar desativação e encerramento das sessões?</span>
                <button type="button" className="btn btn-danger-outline" disabled={busy}
                  onClick={()=>changeStatus(user.id,false)}>Confirmar</button>
                <button type="button" className="btn btn-light" disabled={busy}
                  onClick={()=>setPendingDeactivation(null)}>Cancelar</button>
              </div>:
              <button className="btn btn-outline" type="button" disabled={busy}
                onClick={()=>setPendingDeactivation(user.id)}>Desativar</button>}
          </>:<button className="btn btn-primary" type="button" disabled={busy}
            onClick={()=>changeStatus(user.id,true)}>Reativar</button>}
        </div>)}
      </div>
    </section>
    <section className="panel">
      <h2>Histórico recente de convites</h2>
      <p className="help">Os códigos não são armazenados em texto simples e não aparecem no histórico.</p>
      {invites.length?<div className="table-scroll" role="region" aria-label="Convites da prefeitura" tabIndex={0}>
        <table><thead><tr><th scope="col">Destinatário</th><th scope="col">Função</th>
        <th scope="col">Estado</th><th scope="col">Expiração</th></tr></thead>
        <tbody>{invites.map((invite)=><tr key={invite.id}>
          <td>{invite.email}</td><td>{invite.role==='admin'?'Administrador':'Analista'}</td>
          <td>{({pending:'Pendente',expired:'Expirado',accepted:'Aceito',revoked:'Revogado'} as Record<string,string>)[invite.status]??invite.status}</td>
          <td>{new Date(invite.expires_at).toLocaleString('pt-BR')}</td>
        </tr>)}</tbody></table>
      </div>:<p className="muted">Nenhum convite emitido neste município.</p>}
    </section>
  </div>;
}
