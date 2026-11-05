import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { DocumentTemplateForm } from '@/components/document-template-form';
import { DocumentChecklistStart } from '@/components/document-checklist-start';
import { DocumentItemForm } from '@/components/document-item-form';
import { DOCUMENT_MODALITIES } from '@/lib/document-modalities.mjs';

export const dynamic='force-dynamic';
type ProjectRow={id:string;title:string;opportunity_title:string|null;is_example:boolean|null};
type ChecklistRow={project_id:string;modality:string;created_at:string};
type TemplateCount={modality:string;total:number};
type ItemRow={id:string;title:string;guidance:string;status:'pendente'|'apresentado'|'dispensado';evidence_note:string};
const labels:Record<string,string> = Object.fromEntries(DOCUMENT_MODALITIES);
const states={pendente:'Pendente',apresentado:'Apresentado (declarado)',dispensado:'Dispensado (declarado)'};
export default async function ProjectDocuments({params}:{params:Promise<{id:string}>}){
 const user=await requireSession();
 const {id}=await params;
 if(!z.string().uuid().safeParse(id).success)notFound();
 const [project]=await queryForMunicipality<ProjectRow>(user.municipality_id,
  'SELECT p.id,p.title,o.title AS opportunity_title,o.is_example FROM projects p '+
  'LEFT JOIN opportunities o ON o.id=p.opportunity_id WHERE p.id=$1 AND p.municipality_id=$2',
  [id,user.municipality_id],user.id);
 if(!project)notFound();
 const [[checklist],available]=await Promise.all([
  queryForMunicipality<ChecklistRow>(user.municipality_id,
   'SELECT project_id,modality,created_at FROM project_document_checklists '+
   'WHERE project_id=$1 AND municipality_id=$2',[id,user.municipality_id],user.id),
  queryForMunicipality<TemplateCount>(user.municipality_id,
   'SELECT modality,count(*)::int AS total FROM municipal_document_templates '+
   'WHERE municipality_id=$1 GROUP BY modality',[user.municipality_id],user.id),
 ]);
 const items=checklist?await queryForMunicipality<ItemRow>(user.municipality_id,
   'SELECT id,title,guidance,status,evidence_note FROM project_document_items '+
   'WHERE project_id=$1 AND municipality_id=$2 ORDER BY title,id LIMIT 200',
   [id,user.municipality_id],user.id):[];
 const counts={pendente:0,apresentado:0,dispensado:0};
 for(const item of items)counts[item.status]++;
 return <>
  <div className="section-eyebrow">DOCUMENTAÇÃO DA CANDIDATURA</div>
  <div className="page-heading">
   <div><h1>Checklist documental</h1><p>{project.title} · {project.opportunity_title??'Sem oportunidade vinculada'}</p></div>
   <Link className="btn btn-outline" href={'/projetos/'+id}>← Voltar à ficha</Link>
  </div>
  {project.is_example&&<p className="demo-notice"><strong>FICTÍCIO / TESTE:</strong> a oportunidade de origem é ilustrativa.</p>}
  {checklist?<section className="panel document-overview">
    <h2>Modalidade: {labels[checklist.modality]??checklist.modality}</h2>
    <div className="requirement-stats">
     <div><strong>{counts.pendente}</strong><span>Pendentes</span></div>
     <div><strong>{counts.apresentado}</strong><span>Apresentados (declarados)</span></div>
     <div><strong>{counts.dispensado}</strong><span>Dispensados (declarados)</span></div>
    </div>
    <p className="help">Checklist criado com modelos municipais do momento da inicialização.
      Nenhum documento é validado automaticamente e não há envio de arquivos nesta versão.</p>
   </section>:user.role==='admin'?<DocumentChecklistStart projectId={id} available={available}/>:<section className="panel">
    <h2>Checklist ainda não iniciado</h2>
    <p>Solicite ao administrador municipal o cadastro e a aplicação de documentos da modalidade.</p>
   </section>}
  {checklist&&<section className="panel document-list">
    <h2>Documentos por providenciar</h2>
    {items.map(item=><article className="document-item" key={item.id}>
     <span className="chip">{states[item.status]}</span>
     <h3>{item.title}</h3>
     {item.guidance&&<p className="help">Orientação cadastrada: {item.guidance}</p>}
     <DocumentItemForm key={item.id+'-'+item.status+'-'+item.evidence_note} projectId={id}
       itemId={item.id} initialStatus={item.status} initialNote={item.evidence_note}/>
    </article>)}
    {!items.length&&<p>Nenhum documento foi inicializado. Solicite revisão do modelo.</p>}
   </section>}
  {user.role==='admin'&&<DocumentTemplateForm/>}
  <p className="note">Este checklist é um controle interno, não uma declaração de conformidade jurídica ou
   comprovação de habilitação. Verifique os documentos exigidos na versão oficial do instrumento.</p>
 </>;
}
