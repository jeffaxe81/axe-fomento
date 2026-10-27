import { requireSession } from '@/lib/auth';
import { queryForMunicipality, type Municipality } from '@/lib/db';
import { MunicipalityForm } from '@/components/municipality-form';
export const dynamic = 'force-dynamic';
export default async function MunicipalityPage() {
  const user = await requireSession();
  const [city] = await queryForMunicipality<Municipality>(user.municipality_id, 'SELECT id, name, uf, ibge_code, population, priority_areas FROM municipalities WHERE id=$1', [user.municipality_id]);
  return <><div className="section-eyebrow">DADOS INSTITUCIONAIS</div><div className="page-heading"><div><h1>Perfil municipal</h1><p>Atualize informações que auxiliam a triagem preliminar de oportunidades.</p></div></div><section className="panel wide"><div className="panel-heading"><div><h3>{city.name} / {city.uf}</h3><p>Cadastro utilizado no radar</p></div></div><MunicipalityForm city={city} canEdit={user.role === 'admin'}/></section></>;
}
