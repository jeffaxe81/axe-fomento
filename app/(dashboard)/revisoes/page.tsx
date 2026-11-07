import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
export const dynamic='force-dynamic';
type Row={project_id:string;project_title:string;state:string;revision:number;updated_at:string;requester_name:string};
const labels:Record<string,string>={em_revisao:'Aguardando revisão técnica',revisada:'Aguardando autorização',
 devolvida:'Devolvida para correção',autorizada:'Autorizada internamente'};
export default async function ReviewQueue(){
 const user=await requireSession();const isAdmin=user.role==='admin';
 const rows=await queryForMunicipality<Row>(user.municipality_id,
  'SELECT r.project_id,p.title AS project_title,r.state,r.revision,r.updated_at,'+
  'u.full_name AS requester_name FROM project_internal_reviews r JOIN projects p '+
  'ON p.id=r.project_id AND p.municipality_id=r.municipality_id '+
  'JOIN users u ON u.id=r.submitted_by AND u.municipality_id=r.municipality_id '+
  'WHERE r.municipality_id=$1 AND ($2::uuid IS NULL OR p.owner_user_id=$2::uuid) '+
  "ORDER BY CASE WHEN r.state='em_revisao' THEN 0 WHEN r.state='revisada' THEN 1 "+
  "WHEN r.state='devolvida' THEN 2 ELSE 3 END,r.updated_at,r.project_id LIMIT 100",
  [user.municipality_id,isAdmin?null:user.id],user.id);
 const todo=rows.filter(x=>x.state==='em_revisao').length;
 const technical=rows.filter(x=>x.state==='revisada').length;
 const returned=rows.filter(x=>x.state==='devolvida').length;
 return <>
  <div className="section-eyebrow">GOVERNANÇA MUNICIPAL</div>
  <div className="page-heading"><div><h1>Fila de revisões internas</h1>
   <p>{isAdmin?'Avalie candidaturas e autorizações internas do município.':
    'Acompanhe as revisões dos seus projetos.'}</p></div>
   <Link href="/projetos" className="btn btn-outline">Meus projetos</Link>
  </div>
  <section className="panel"><div className="requirement-stats">
   <div><strong>{todo}</strong><span>Aguardando revisão</span></div>
   <div><strong>{technical}</strong><span>Aguardando autorização</span></div>
   <div><strong>{returned}</strong><span>Devolvidas</span></div>
  </div>
   <p className="help">Este fluxo é interno. Autorizar não significa protocolar a
    candidatura em sistemas externos.</p>
  </section>
  <section className="panel"><h2>Projetos em revisão</h2>
   {rows.length?<div className="review-events">{rows.map(item=><article className="review-event" key={item.project_id}>
    <span className="chip">{labels[item.state]??item.state}</span>
    <h3><Link href={'/projetos/'+item.project_id+'/revisao'}>{item.project_title}</Link></h3>
    <p>Solicitante: {item.requester_name} · Revisão {item.revision} ·
     {' '}{new Date(item.updated_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
   </article>)}</div>:<p className="muted">Nenhum projeto em revisão nesta lista.
    Abra a ficha do projeto para iniciar uma revisão.</p>}
   {rows.length===100&&<p className="note">Lista limitada aos primeiros 100 registros,
    podendo estar incompleta.</p>}
  </section>
 </>;
}
