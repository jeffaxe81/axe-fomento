import Link from 'next/link';
import { requireSession, verifiedCookie } from '@/lib/auth';
import { query, queryForMunicipality } from '@/lib/db';
import { UserGovernance } from '@/components/user-governance';
export const dynamic='force-dynamic';

type MunicipalUser={id:string;full_name:string;email:string;role:'admin'|'analyst';active:boolean};
type Invite={id:string;email:string;role:string;issued_at:string;expires_at:string;status:string};

export default async function UserAdministration(){
  const user=await requireSession();
  if(user.role!=='admin')return <section className="panel">
    <h1>Administração municipal</h1><p>Esta área está restrita a administradores municipais.</p>
    <Link href="/" className="btn btn-outline">Voltar</Link>
  </section>;
  const sid=await verifiedCookie();
  if(!sid)return <p>Autenticação indisponível.</p>;
  const [users,invites]=await Promise.all([
    queryForMunicipality<MunicipalUser>(user.municipality_id,
      'SELECT id,full_name,email,role,active FROM users WHERE municipality_id=$1 '+
      'ORDER BY active DESC,lower(full_name),id LIMIT 200',[user.municipality_id],user.id),
    query<Invite>('SELECT id,email,role,issued_at,expires_at,status FROM '+
      'public.auth_admin_list_invites($1,$2)',[user.id,sid.sessionId]),
  ]);
  return <>
    <div className="section-eyebrow">GOVERNANÇA E ACESSO</div>
    <div className="page-heading"><div><h1>Usuários municipais</h1>
      <p>Convites por função, revogação de sessões e histórico de contas do município.</p>
    </div><Link href="/seguranca" className="btn btn-outline">Segurança da conta</Link></div>
    <UserGovernance users={users} invites={invites} currentUserId={user.id}/>
  </>;
}
