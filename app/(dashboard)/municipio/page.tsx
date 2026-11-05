import { requireSession } from '@/lib/auth';
import { queryForMunicipality, type Municipality } from '@/lib/db';
import { MunicipalityForm } from '@/components/municipality-form';
import { CapagPanel } from '@/components/capag-panel';

export const dynamic='force-dynamic';
type CapagSnapshot={
 classification:string;base_year:number;reference_date:string;official_url:string;
 source_label:string;version:number;recorded_at:string;
};
export default async function MunicipalityPage(){
 const user=await requireSession();
 const [[city],capagRows]=await Promise.all([
  queryForMunicipality<Municipality>(user.municipality_id,
    'SELECT id,name,uf,ibge_code,population,priority_areas FROM municipalities WHERE id=$1',
    [user.municipality_id],user.id),
  queryForMunicipality<CapagSnapshot>(user.municipality_id,
    "SELECT classification,base_year,to_char(reference_date,'YYYY-MM-DD') AS reference_date,"+
    "official_url,source_label,version,recorded_at FROM municipal_capag WHERE municipality_id=$1",
    [user.municipality_id],user.id),
 ]);
 return <>
  <div className="section-eyebrow">DADOS INSTITUCIONAIS</div>
  <div className="page-heading"><div><h1>Perfil municipal</h1>
    <p>Atualize dados utilizados na triagem preliminar e documente a referência fiscal.</p></div></div>
  <section className="panel wide">
   <div className="panel-heading"><div><h3>{city.name} / {city.uf}</h3>
    <p>Cadastro utilizado no radar</p></div></div>
   <MunicipalityForm city={city} canEdit={user.role==='admin'}/>
  </section>
  <CapagPanel initial={capagRows[0]??null} canEdit={user.role==='admin'}/>
 </>;
}
