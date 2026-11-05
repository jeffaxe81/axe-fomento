import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { SourceReviewPanel } from '@/components/source-review-panel';

export const dynamic='force-dynamic';
type SourceRow={id:string;external_id:string;title:string;provider:string;version:number;review_state:string;last_seen_at:string;source_url:string};
type VersionRow={version:number;snapshot:{external_id?:string;title?:string;provider?:string;source_url?:string};observed_at:string};
type ReviewRow={decision:string;justification:string;reviewed_at:string;full_name:string};
function date(value:string){return new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});}
const fields=[['title','Título'],['provider','Órgão'],['source_url','Origem']] as const;
export default async function SourceProgramDetail({params}:{params:Promise<{id:string}>}) {
  const user=await requireSession();
  if(user.role!=='admin') notFound();
  const {id}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
  const [program]=await queryForMunicipality<SourceRow>(user.municipality_id,
    'SELECT id,external_id,title,provider,version,review_state,last_seen_at,source_url '+
    'FROM source_programs WHERE municipality_id=$1 AND id=$2',
    [user.municipality_id,id],user.id);
  if(!program)notFound();
  const [versions,reviews]=await Promise.all([
    queryForMunicipality<VersionRow>(user.municipality_id,
      'SELECT version,snapshot,observed_at FROM source_program_versions WHERE municipality_id=$1 '+
      'AND program_id=$2 ORDER BY version DESC LIMIT 30',[user.municipality_id,id],user.id),
    queryForMunicipality<ReviewRow>(user.municipality_id,
      'SELECT r.decision,r.justification,r.reviewed_at,u.full_name FROM source_program_reviews r '+
      'JOIN users u ON u.id=r.reviewer_id AND u.municipality_id=r.municipality_id '+
      'WHERE r.municipality_id=$1 AND r.program_id=$2 ORDER BY r.reviewed_at DESC LIMIT 30',
      [user.municipality_id,id],user.id),
  ]);
  return <>
    <div className="section-eyebrow">RASTREABILIDADE DE FONTES</div>
    <div className="page-heading"><div><h1>{program.title}</h1><p>Identificador externo: {program.external_id}</p></div>
      <Link className="btn btn-outline" href="/fontes">Voltar às fontes</Link></div>
    <section className="panel">
      <h2>Dados conferíveis</h2>
      <p><strong>Órgão informado:</strong> {program.provider}</p>
      <p><strong>Situação interna:</strong> {program.review_state} · Versão {program.version}</p>
      <p><strong>Última consulta:</strong> {date(program.last_seen_at)}</p>
      <p><strong>Prazo de candidatura:</strong> Não informado / não verificado</p>
      <p><strong>Valor de financiamento:</strong> Não informado / não verificado</p>
      <p><a className="source-link" href={program.source_url} rel="noopener noreferrer" target="_blank">
        Consultar catálogo da fonte original</a></p>
      <p className="help">A URL direciona ao catálogo, não a um edital individual. Não há garantia de abertura de prazo.</p>
    </section>
    <section className="panel source-table">
      <h2>Versões e alterações</h2>
      {versions.map((current,index)=>{
        const previous=versions[index+1];
        return <div key={current.version} className="source-version">
          <h3>Versão {current.version} · {date(current.observed_at)}</h3>
          {previous? <ul>{fields.filter(([key])=>current.snapshot[key]!==previous.snapshot[key])
            .map(([key,label])=><li key={key}>{label}: <strong>{previous.snapshot[key]??'Não informado'}</strong>
              {' → '}<strong>{current.snapshot[key]??'Não informado'}</strong></li>)}
            {fields.every(([key])=>current.snapshot[key]===previous.snapshot[key]) && <li>Sem mudança nos campos monitorados.</li>}
          </ul>:<p className="muted">Primeira versão registrada: {current.snapshot.title ?? 'Sem título'}.</p>}
        </div>;
      })}
    </section>
    <SourceReviewPanel id={program.id} version={program.version}/>
    <section className="panel source-table">
      <h2>Histórico de decisões</h2>
      {reviews.length?<ul className="source-review-history">{reviews.map((item,index)=><li key={index}>
        <strong>{item.decision==='approved'?'Aprovado':'Rejeitado'}</strong> em {date(item.reviewed_at)}
        {' · '}{item.full_name}<p>{item.justification}</p>
      </li>)}</ul>:<p className="muted">Nenhuma decisão registrada.</p>}
    </section>
  </>;
}
