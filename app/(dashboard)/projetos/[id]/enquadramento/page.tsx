import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {READ_MODALITY_CHECKS_SQL} from '@/lib/modality-map-sql.mjs';
import {countReviews,MODALITIES,modalityLabel,reviewLabel} from '@/lib/modality-map.mjs';
import {normativeVersionLabel} from '@/lib/normative-source.mjs';
import {AddModalityCheck,ReviewModalityCheck} from '@/components/modality-map-forms';
export const dynamic='force-dynamic';
type Project={id:string;title:string;owner_user_id:string|null;is_example:boolean|null};
type NormOption={id:string;reference_code:string;title:string;version:number;source_section:string};
type Check={id:string;modality:string;rule_number:number;criterion:string;
 normative_source_id:string;normative_version_id:string;normative_version:number;
 reference_code:string;normative_title:string;jurisdiction:string;state_uf:string|null;
 source_url:string;source_section:string;excerpt:string;snapshot_sha256:string;
 valid_from:string;valid_until:string|null;revision:number;status:string;
 justification:string;reviewer_name:string;recorded_at:string};
export default async function ModalityMapPage({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<Project>(actor.municipality_id,
  `SELECT p.id,p.title,p.owner_user_id,o.is_example FROM projects p
  LEFT JOIN opportunities o ON o.id=p.opportunity_id
  WHERE p.id=$1 AND p.municipality_id=$2`,[id,actor.municipality_id],actor.id);
 if(!project)notFound();
 const [checks,options]=await Promise.all([
  queryForMunicipality<Check>(actor.municipality_id,
   READ_MODALITY_CHECKS_SQL,[actor.municipality_id,id],actor.id),
  queryForMunicipality<NormOption>(actor.municipality_id,
   `SELECT v.id,s.reference_code,s.title,v.version,v.source_section
   FROM municipal_normative_versions v
   JOIN municipal_normative_sources s ON s.id=v.source_id
    AND s.municipality_id=v.municipality_id
   WHERE v.municipality_id=$1
   ORDER BY s.reference_code,v.version DESC LIMIT 400`,[actor.municipality_id],actor.id)
 ]);
 const totals=countReviews(checks);
 const canWrite=process.env.ENABLE_MODALITY_MAP==='yes'&&!project.is_example&&
  (actor.role==='admin'||project.owner_user_id===actor.id);
 return <>
  <div className="section-eyebrow">ENQUADRAMENTO PRELIMINAR · AF-029</div>
  <div className="page-heading"><div>
   <h1>Mapa de enquadramento por modalidade</h1><p>{project.title}</p>
   </div><div className="radar-actions">
   <Link className="btn btn-outline" href={'/projetos/'+id+'/requisitos'}>Matriz de requisitos</Link>
   <Link className="btn btn-outline" href="/normativos">Base normativa</Link>
   <Link className="btn btn-outline" href={'/projetos/'+id}>Voltar ao projeto</Link>
   </div></div>
  <section className="panel">
   <h2>Pontos de validação documental</h2>
   <p>Este mapa reúne critérios cadastrados por pessoas autorizadas.
    <strong> Não certifica elegibilidade, legalidade, vigência ou aprovação de financiamento.</strong>
    Consulte a norma original, a matriz de requisitos do edital e a assessoria jurídica.</p>
   <dl className="project-details">
    <div className="profile-row"><dt>Critérios registrados</dt><dd>{checks.length}</dd></div>
    <div className="profile-row"><dt>Atendidos (declarados)</dt><dd>{totals.atendido}</dd></div>
    <div className="profile-row"><dt>Não atendidos (declarados)</dt><dd>{totals.nao_atendido}</dd></div>
    <div className="profile-row"><dt>Pendentes</dt><dd>{totals.pendente}</dd></div>
    <div className="profile-row"><dt>Não aplicáveis (declarados)</dt><dd>{totals.nao_aplicavel}</dd></div>
   </dl>
   {project.is_example&&<p className="demo-notice">Projeto de oportunidade fictícia:
    cadastro e revisão desabilitados.</p>}
  </section>
  <section className="panel">
   <h2>Incluir critério com referência histórica</h2>
   {canWrite&&options.length>0?<AddModalityCheck projectId={id} options={options}/>:
    <p className="muted">Requer homologação, titularidade do projeto ou perfil
     administrativo e pelo menos uma versão cadastrada em Base normativa.</p>}
   {options.length===400&&<p className="note">Seleção limitada a 400 versões
    normativas; selecione uma das versões exibidas.</p>}
  </section>
  {MODALITIES.map(([modality,label])=>{
   const group=checks.filter(c=>c.modality===modality);
   if(!group.length)return null;
   return <section className="panel" key={modality}>
    <h2>{label} · {group.length} critérios</h2>
    <div className="review-events">{group.map(c=><article key={c.id} className="review-event">
     <span className="chip">{modalityLabel(c.modality)} · regra {c.rule_number}</span>
     <span className="chip">{reviewLabel(c.status)}</span>
     <h3>{c.criterion}</h3>
     <p><strong>Referência vinculada:</strong>
      {' '}<Link href={'/normativos/'+c.normative_source_id}>
       {c.reference_code} · v{c.normative_version} · {c.source_section}</Link>
     </p>
     <p><strong>Trecho declarado:</strong> {c.excerpt}</p>
     <p><strong>Vigência:</strong> {normativeVersionLabel(c.valid_from,c.valid_until)}</p>
     <p><a href={c.source_url} target="_blank" rel="noopener noreferrer">
      Consultar fonte indicada (não verificada)</a></p>
     <p><strong>Última análise:</strong> {c.justification}</p>
     <p className="help">Revisão {c.revision} · Autor: {c.reviewer_name} ·
      {' '}{new Date(c.recorded_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
     <p><Link href={'/projetos/'+id+'/enquadramento/'+c.id}>
      Histórico de avaliações e versão normativa vinculada</Link></p>
     {canWrite&&<ReviewModalityCheck key={c.id+'-'+c.revision}
      projectId={id} checkId={c.id} revision={c.revision} currentStatus={c.status}/>}
    </article>)}</div>
   </section>;
  })}
  {!checks.length&&<section className="panel">
   <h2>Sem critérios ainda</h2><p className="muted">Cadastre um ponto a conferir
    e associe uma versão normativa para iniciar o diagnóstico.</p>
  </section>}
 </>;
}
