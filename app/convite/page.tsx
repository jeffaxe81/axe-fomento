import { InvitationAccept } from '@/components/invitation-accept';
export const metadata={title:'Convite institucional | AXE Fomento'};
export default function InvitationPage(){
  return <div className="login-shell">
    <InvitationAccept/>
    <aside className="login-side">
      <span>AXES FOMENTO · ACESSO INSTITUCIONAL</span>
      <h2>Uma prefeitura.<br/>Contas individualizadas.</h2>
      <p>O administrador municipal emite um convite com função e validade definidas.
        A pessoa convidada configura sua senha e depois autentica-se normalmente.</p>
    </aside>
  </div>;
}
