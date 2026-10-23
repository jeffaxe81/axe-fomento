import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';
export default async function LoginPage() {
  if (await getSession()) redirect('/');
  return <main className="login-shell"><section className="login-card"><div className="brand login-brand"><span className="brand-mark">A</span><div><strong>AXES <span>FOMENTO</span></strong><small>Inteligência em captação</small></div></div><div className="login-separator"/><div className="section-eyebrow">ACESSO INSTITUCIONAL</div><h1>Bem-vindo de volta</h1><p>Entre para acompanhar oportunidades e projetos do seu município.</p><LoginForm/><div className="login-footnote">Acesso restrito a usuários autorizados. Cadastre o primeiro administrador pelo comando de bootstrap.</div></section><aside className="login-side"><span>GESTÃO PÚBLICA INTELIGENTE</span><h2>Mais oportunidades.<br/>Mais impacto para<br/>sua cidade.</h2><p>Uma plataforma para conectar prioridades municipais a fontes de financiamento.</p><div className="login-art">✧</div></aside></main>;
}
