import pg from 'pg';
// Break-glass only. Use the privileged, ephemeral setup service. NEVER expose this command via the web.
const {
  DATABASE_ADMIN_URL, MFA_RESET_USER_EMAIL, MFA_RESET_MUNICIPALITY_ID,
  MFA_RESET_TICKET, MFA_RESET_REASON, MFA_RESET_OPERATOR, MFA_RESET_APPROVER, MFA_RESET_CONFIRM
}=process.env;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!DATABASE_ADMIN_URL||!MFA_RESET_USER_EMAIL||!uuid.test(MFA_RESET_MUNICIPALITY_ID??'')
 ||!MFA_RESET_TICKET||!/^[-A-Za-z0-9_.]{5,80}$/.test(MFA_RESET_TICKET)
 ||!MFA_RESET_REASON||MFA_RESET_REASON.trim().length<12||MFA_RESET_REASON.length>500
 ||!MFA_RESET_OPERATOR||!MFA_RESET_APPROVER
 ||MFA_RESET_OPERATOR.trim().toLowerCase()===MFA_RESET_APPROVER.trim().toLowerCase()
 ||MFA_RESET_OPERATOR.length>120||MFA_RESET_APPROVER.length>120
 ||MFA_RESET_CONFIRM!=='RESET_MFA_REVOKE_ALL_SESSIONS') {
  throw new Error('Reset MFA bloqueado: informe DATABASE_ADMIN_URL, email, município UUID, ticket, motivo, operador e aprovador distintos, mais confirmação explícita.');
}
const db=new pg.Client({connectionString:DATABASE_ADMIN_URL});
await db.connect();
let active=false;
try{
  await db.query('BEGIN');active=true;
  const [target]=(await db.query(
    'SELECT id,municipality_id,mfa_enabled FROM public.users WHERE lower(email)=lower($1) AND municipality_id=$2::uuid AND active=true FOR UPDATE',
    [MFA_RESET_USER_EMAIL.trim(),MFA_RESET_MUNICIPALITY_ID]
  )).rows;
  if(!target||!target.mfa_enabled)throw new Error('Conta não encontrada ou MFA não ativo; operação cancelada.');
  await db.query(`UPDATE public.users SET mfa_enabled=false,mfa_secret_cipher=NULL,
    mfa_pending_cipher=NULL,mfa_last_step=NULL WHERE id=$1`,[target.id]);
  const result=await db.query(`UPDATE public.user_sessions SET revoked_at=clock_timestamp()
    WHERE user_id=$1 AND revoked_at IS NULL`,[target.id]);
  await db.query(`INSERT INTO public.audit_events
    (municipality_id,actor_user_id,action,record_id,metadata)
    VALUES($1,NULL,'security.mfa_reset',$2,$3::jsonb)`,
    [target.municipality_id,target.id,JSON.stringify({
      ticket:MFA_RESET_TICKET,reason:MFA_RESET_REASON.trim(),
      operator:MFA_RESET_OPERATOR.trim(),approver:MFA_RESET_APPROVER.trim(),
      sessionsRevoked:result.rowCount
    })]);
  await db.query('COMMIT');active=false;
  console.log('Reset MFA autorizado e auditado. Ticket: '+MFA_RESET_TICKET+
    '; sessões revogadas: '+result.rowCount+'. Usuário precisará configurar novo MFA.');
}catch(error){if(active)await db.query('ROLLBACK');throw error;}finally{await db.end();}
