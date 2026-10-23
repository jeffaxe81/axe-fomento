import { requireSession } from '@/lib/auth';
import { SecurityPanel } from '@/components/security-panel';
import { ChangePasswordPanel } from '@/components/change-password-panel';
export default async function SecurityPage(){
  await requireSession();
  return <><div className="page-heading"><div>
    <div className="section-eyebrow">PROTEÇÃO DA CONTA</div>
    <h1>Segurança do acesso</h1>
    <p>Ative a verificação em duas etapas e acompanhe suas sessões.</p>
  </div></div><SecurityPanel/><ChangePasswordPanel/></>;
}
