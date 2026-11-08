import Link from 'next/link';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {ReadinessCaseCreate,ReadinessRubricCreate} from '@/components/readiness-create-forms';
export const dynamic='force-dynamic';
type Case={id:string;kind:string;title:string;created_at:string;author_name:string;revision:number|null;score:string|null};
type Project={id:string;title:string};
type Rubric={id:string;rubric_key:string;version:number;criteria:{id:string;label:string;weight:number}[]};
export default async function ReadinessIndex(){
 const actor=await requireSession(),enabled=process.env.ENABLE_READINESS_EVALUATOR==='yes';
 const [cases,projects,rubrics]=await Promise.all([
  queryForMunicipality<Case>(actor.municipality_id,`
   SELECT c.id,c.kind,c.title,c.created_at,u.full_name AS author_name,
    latest.revision,latest.score
   FROM readiness_cases c JOIN users u ON u.id=c.created_by AND u.municipality_id=c.municipality_id
   LEFT JOIN LATERAL(
    SELECT revision,score FROM readiness_assessments a
    WHERE a.case_id=c.id AND a.municipality_id=c.municipality_id
    ORDER BY revision DESC LIMIT 1
   ) latest ON true
   WHERE c.municipality_id=$1::uuid ORDER BY c.created_at DESC,c.id DESC LIMIT 100`,
   [actor.municipality_id],actor.id),
  queryForMunicipality<Project>(actor.municipality_id,`
   SELECT id,title FROM projects WHERE municipality_id=$1::uuid
   AND ($2::text='admin' OR owner_user_id=$3::uuid)
   ORDER BY created_at DESC,id DESC LIMIT 200`,[actor.municipality_id,actor.role,actor.id],actor.id),
  queryForMunicipality<Rubric>(actor.municipality_id,`
   SELECT DISTINCT ON (rubric_key) id,rubric_key,version,criteria
   FROM readiness_rubric_versions WHERE municipality_id=$1::uuid
   ORDER BY rubric_key,version DESC LIMIT 50`,[actor.municipality_id],actor.id)
 ]);
 return <>
  <div className="section-eyebrow">AF-042 A AF-050 · PRÉ-VIABILIDADE</div>
  <div className="page-heading"><div><h1>Avaliador de ideias e projetos</h1>
   <p>Triagem interna orientativa com rubricas e evidências versionadas.</p></div>
   <Link href="/" className="btn btn-outline">Voltar ao painel</Link></div>
  <p className="note">A pontuação não atesta elegibilidade, aprovação jurídica ou concessão de recursos.
   Impedimentos informados pela equipe permanecem destacados separadamente.</p>
  {!enabled&&<p className="demo-notice">Avaliador em homologação: operações de gravação desabilitadas.</p>}
  <section className="panel"><h2>Nova entrada</h2>
   {enabled?<ReadinessCaseCreate projects={projects}/>:<p>Ativação pendente do administrador operacional.</p>}
  </section>
  {actor.role==='admin'&&<section className="panel"><h2>Rubricas ponderadas</h2>
   <p>Cadastre uma rubrica inicial ou uma nova versão. A soma dos pesos precisa ser 100;
    cada avaliação guarda exatamente a versão utilizada.</p>
   {enabled&&<ReadinessRubricCreate rubrics={rubrics.map(r=>({key:r.rubric_key,version:r.version}))}/>}
   {rubrics.map(r=><p key={r.id}><strong>{r.rubric_key}</strong> · versão {r.version} ·
    {' '}{r.criteria.length} critérios</p>)}
  </section>}
  <section className="panel"><h2>Entradas registradas ({cases.length})</h2>
   {!cases.length&&<p className="muted">Nenhuma ideia ou projeto documentado cadastrado.</p>}
   {cases.map(c=><article key={c.id} className="review-event">
    <span className="chip">{c.kind==='idea'?'Ideia inicial':'Projeto documentado'}</span>
    <h3><Link href={'/avaliador/'+c.id}>{c.title}</Link></h3>
    <p className="help">Por {c.author_name} · {new Date(c.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}
     {' '}· {c.revision===null?'Sem avaliação':'Avaliação v'+c.revision+' · '+c.score+'/100 (orientativa)'}</p>
   </article>)}
   {cases.length===100&&<p className="note">Exibidos os 100 registros mais recentes.</p>}
  </section>
 </>;
}
