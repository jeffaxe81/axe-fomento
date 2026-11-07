import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { expiryStatus,expiryWithin,todaySaoPaulo } from '@/lib/document-validity.mjs';

export const dynamic='force-dynamic';
type ExpiringDocument={
 id:string;project_id:string;project_title:string;title:string;
 valid_until:string;renewal_owner_id:string;renewal_owner_name:string;
 owner_active:boolean;validity_evidence_note:string;
};
const filters=[
 {key:'expired',label:'Vencidos'},
 {key:'7',label:'Vencidos e próximos 7 dias'},
 {key:'30',label:'Vencidos e próximos 30 dias'},
 {key:'90',label:'Vencidos e próximos 90 dias'},
 {key:'all',label:'Todos com validade'},
];
export default async function DocumentExpiryAgenda({
 searchParams,
}:{searchParams:Promise<{faixa?:string}>}){
 const user=await requireSession();
 const search=await searchParams;
 const range=filters.some(x=>x.key===search.faixa)?search.faixa??'30':'30';
 const today=todaySaoPaulo();
 const documents=await queryForMunicipality<ExpiringDocument>(user.municipality_id,
   "SELECT d.id,d.project_id,p.title AS project_title,d.title,"+
   "to_char(d.valid_until,'YYYY-MM-DD') AS valid_until,"+
   "d.renewal_owner_user_id AS renewal_owner_id,u.full_name AS renewal_owner_name,"+
   "u.active AS owner_active,d.validity_evidence_note "+
   "FROM project_document_items d JOIN projects p "+
   "ON p.id=d.project_id AND p.municipality_id=d.municipality_id "+
   "JOIN users u ON u.id=d.renewal_owner_user_id AND u.municipality_id=d.municipality_id "+
   "WHERE d.municipality_id=$1 AND d.valid_until IS NOT NULL "+
   "ORDER BY d.valid_until,d.id LIMIT 500",
   [user.municipality_id],user.id);
 const rows=documents.map(item=>({...item,expiry:expiryStatus(item.valid_until,today)}))
  .filter(item=>expiryWithin(item.expiry,range));
 const overdue=rows.filter(x=>x.expiry.kind==='expired').length;
 const soon=rows.filter(x=>x.expiry.kind==='due7'||x.expiry.kind==='due30').length;
 return <>
  <div className="section-eyebrow">GESTÃO MUNICIPAL DE DOCUMENTAÇÃO</div>
  <div className="page-heading">
   <div><h1>Agenda de validade documental</h1>
    <p>Vencimentos declarados dos documentos dos projetos do município, com responsáveis pela renovação.</p>
   </div>
   <Link href="/projetos" className="btn btn-outline">Meus projetos</Link>
  </div>
  <section className="panel document-overview">
   <h2>Referência: {today.split('-').reverse().join('/')}</h2>
   <div className="requirement-stats">
    <div><strong>{overdue}</strong><span>Vencidos neste filtro</span></div>
    <div><strong>{soon}</strong><span>Vencem em até 30 dias</span></div>
    <div><strong>{rows.length}</strong><span>Documentos listados</span></div>
   </div>
   <p className="help">A lista utiliza a data civil de Brasília (America/Sao_Paulo).
    As datas foram informadas pela equipe; nenhum vencimento é inferido do arquivo anexado.
    Não há envio automático de e-mails ou notificações.</p>
   <nav aria-label="Filtrar vencimentos" className="expiry-filters">
    {filters.map(filter=><Link href={'/documentos/validade?faixa='+filter.key}
      aria-current={range===filter.key?'page':undefined} key={filter.key}>
      {filter.label}</Link>)}
   </nav>
  </section>
  <section className="panel">
   <h2>Documentos e responsáveis</h2>
   {rows.length?<div className="expiry-rows">
    {rows.map(row=><article className="expiry-entry" key={row.id}>
      <span className="chip">{row.expiry.label}</span>
      <h3><Link href={'/projetos/'+row.project_id+'/documentos'}>
       {row.project_title} — {row.title}</Link></h3>
      <p><strong>Validade declarada:</strong> {row.valid_until.split('-').reverse().join('/')}
       {' · '}
       {row.expiry.days!==null&&(row.expiry.days<0
        ? 'Vencido há '+(-row.expiry.days)+' dias'
        : 'Restam '+row.expiry.days+' dia(s)')}
      </p>
      <p><strong>Responsável pela renovação:</strong> {row.renewal_owner_name}
       {!row.owner_active&&' · Conta desativada, reatribuir!'}</p>
      <p><strong>Justificativa da data:</strong> {row.validity_evidence_note}</p>
    </article>)}
   </div>:<p className="muted">Nenhum documento com validade registrada corresponde a este filtro.</p>}
   {documents.length===500&&<p className="note">Foram consultados até 500 documentos,
      em ordem de vencimento. A lista pode estar incompleta; refine o acompanhamento
      do município ou consulte os projetos diretamente.</p>}
  </section>
 </>;
}
