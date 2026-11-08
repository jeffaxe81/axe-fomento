import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { SecretariatAdmin } from '@/components/secretariat-admin';
export const dynamic='force-dynamic';
type Secretariat={id:string;name:string};
type User={id:string;full_name:string;role:string};
type Member={secretariat_id:string;user_id:string;full_name:string;revoked_at:string|null};
export default async function MunicipalSecretariatsPage(){
 const user=await requireSession();
 if(user.role!=='admin')return <section className="panel">
  <h1>Secretarias municipais</h1>
  <p>Somente administradores municipais podem gerenciar integrações institucionais.</p>
  <Link href="/projetos" className="btn btn-outline">Meus projetos</Link>
 </section>;
 const [secretariats,users,members]=await Promise.all([
  queryForMunicipality<Secretariat>(user.municipality_id,
   'SELECT id,name FROM municipal_secretariats WHERE municipality_id=$1 ORDER BY name,id LIMIT 100',
   [user.municipality_id],user.id),
  queryForMunicipality<User>(user.municipality_id,
   'SELECT id,full_name,role FROM users WHERE municipality_id=$1 AND active=true '+
   'ORDER BY lower(full_name),id LIMIT 200',[user.municipality_id],user.id),
  queryForMunicipality<Member>(user.municipality_id,
   'SELECT m.secretariat_id,m.user_id,u.full_name,m.revoked_at FROM municipal_secretariat_members m '+
   'JOIN users u ON u.id=m.user_id AND u.municipality_id=m.municipality_id '+
   'WHERE m.municipality_id=$1 ORDER BY u.full_name,m.secretariat_id LIMIT 1000',
   [user.municipality_id],user.id),
 ]);
 return <>
  <div className="section-eyebrow">GESTÃO DE SECRETARIAS</div>
  <div className="page-heading"><div><h1>Secretarias e responsáveis</h1>
   <p>Configure quais contas municipais podem ser responsáveis por tarefas em cada secretaria.</p>
  </div><Link href="/tarefas" className="btn btn-outline">Central de tarefas</Link></div>
  <SecretariatAdmin secretariats={secretariats} users={users} members={members}/>
  <p className="note">Contas revogadas deixam de estar disponíveis para novas atribuições.
   Uma vinculação com tarefas em aberto só pode ser revogada após concluir ou transferir essas tarefas.</p>
 </>;
}
