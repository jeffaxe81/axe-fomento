import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality, type Municipality } from '@/lib/db';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const [city] = await queryForMunicipality<Municipality>(user.municipality_id, 'SELECT id, name, uf, ibge_code, population, priority_areas FROM municipalities WHERE id=$1', [user.municipality_id]);
  if (!city) return <div>Município indisponível. Contate o administrador.</div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">A</span><div><strong>AXES <span>FOMENTO</span></strong><small>Inteligência em captação</small></div></div>
      <div className="sidebar-section">PLATAFORMA</div>
      <nav aria-label="Navegação principal" className="nav">
        <Link href="/">▦ <span>Visão geral</span></Link>
        <Link href="/oportunidades">◈ <span>Radar de oportunidades</span></Link>
        <Link href="/projetos">▤ <span>Meus projetos</span></Link>
        <Link href="/municipio">◉ <span>Perfil municipal</span></Link>
      </nav>
      <div className="sidebar-bottom"><div className="municipality-tag"><small>MUNICÍPIO ATIVO</small><strong>{city.name} / {city.uf}</strong></div><div className="version">V1 · MVP de validação</div></div>
    </aside>
    <div className="work-area">
      <header className="topbar"><div><span className="breadcrumb">Gestão de fomento público</span><strong>{city.name} • {city.uf}</strong></div><div className="user-controls"><span className="user-pill">{user.full_name} <small>({user.role})</small></span><form action="/api/auth/logout" method="post"><button type="submit" className="button-link">Sair</button></form></div></header>
      <main className="content">{children}</main>
      <footer className="footer">Axes Fomento · Radar em validação — verifique sempre as condições nas fontes oficiais.</footer>
    </div>
  </div>;
}
