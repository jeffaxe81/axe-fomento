import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {FINANCIER_TYPES,FINANCIER_MODALITIES,FINANCIER_AREAS,
 CHECK_LABELS} from '@/lib/financier-directory.mjs';
import {FINANCIER_HISTORY_SQL} from '@/lib/financier-directory-sql.mjs';
import {AddFinancierVersion} from '@/components/financier-forms';
export const dynamic='force-dynamic';
type Institution={id:string;name:string;reference_code:string;
 institution_type:string;financing_modalities:string[];thematic_areas:string[];
 created_at:string;created_by:string};
type Version={id:string;version:number;reference_url:string;reference_title:string;
 reference_section:string;check_status:string;checked_on:string|null;
 evidence_note:string;snapshot_sha256:string;recorded_at:string;author_name:string};

export default async function FinancierDetail({params}:{params:Promise<{id:string}>}){
 const actor=await requireSession(),{id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [institution]=await queryForMunicipality<Institution>(actor.municipality_id,
  'SELECT id,name,reference_code,institution_type,financing_modalities,'+
   'thematic_areas,created_at,created_by FROM municipal_financiers '+
   'WHERE municipality_id=$1::uuid AND id=$2::uuid',
  [actor.municipality_id,id],actor.id);
 if(!institution)notFound();
 const versions=await queryForMunicipality<Version>(actor.municipality_id,
  FINANCIER_HISTORY_SQL,[actor.municipality_id,id],actor.id);
 const current=versions[0];
 const enabled=process.env.ENABLE_FINANCIER_DIRECTORY==='yes';
 const clock=(s:string)=>new Date(s).toLocaleString('pt-BR',
  {timeZone:'America/Sao_Paulo'});
 const date=(d:string|null)=>d?d.split('-').reverse().join('/'):'Não registrada';
 return <>
  <div className="section-eyebrow">DIRETÓRIO NACIONAL · AF-034</div>
  <div className="page-heading">
   <div><h1>{institution.name}</h1><p>{institution.reference_code} ·
    {' '}{FINANCIER_TYPES[institution.institution_type]??'Outra instituição'}</p></div>
   <Link className="btn btn-outline" href="/financiadores">Voltar ao diretório</Link>
  </div>
  <section className="panel">
   <h2>Classificação declarada</h2>
   <p><strong>Modalidades:</strong> {institution.financing_modalities.map(
    k=>FINANCIER_MODALITIES[k]??k).join(', ')}</p>
   <p><strong>Áreas:</strong> {institution.thematic_areas.map(
    k=>FINANCIER_AREAS[k]??k).join(', ')}</p>
   <p>Classificação registrada por integrante da equipe municipal.
    Não é comprovação de instrumento financeiro ativo ou de elegibilidade.</p>
  </section>
  <section className="panel">
   <h2>Histórico de fontes ({versions.length} versões exibidas)</h2>
   {versions.map(v=><article key={v.id} data-version={v.version}
    className="review-event">
    <span className="chip">Versão {v.version} ·
     {' '}{CHECK_LABELS[v.check_status]??'Situação informada'}</span>
    <h3>{v.reference_title}</h3>
    <p><strong>Seção:</strong> {v.reference_section}</p>
    <p><strong>Data da consulta humana:</strong> {date(v.checked_on)}</p>
    <p><strong>Observação e evidência declarada:</strong> {v.evidence_note}</p>
    <p><a href={v.reference_url} target="_blank" rel="noopener noreferrer">
     Abrir página de referência (verificação independente necessária)</a></p>
    <p className="help">Registrado por {v.author_name} em {clock(v.recorded_at)} ·
     Fingerprint SHA-256: <code>{v.snapshot_sha256}</code></p>
   </article>)}
   {versions.length===100&&<p className="note">Exibidas até 100 versões recentes;
    as anteriores permanecem no banco.</p>}
  </section>
  <section className="panel">
   <h2>Registrar nova observação</h2>
   {current&&actor.role==='admin'&&enabled&&current.version<1000?
    <AddFinancierVersion financierId={id} expectedVersion={current.version}/>:
    <p className="muted">Registro indisponível por permissão, limite
     de versões ou homologação pendente.</p>}
  </section>
 </>;
}
