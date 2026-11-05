import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { DocumentTemplateForm } from '@/components/document-template-form';
import { DocumentChecklistStart } from '@/components/document-checklist-start';
import { DocumentItemForm } from '@/components/document-item-form';
import { DocumentVersionUpload } from '@/components/document-version-upload';
import { DOCUMENT_MODALITIES } from '@/lib/document-modalities.mjs';

export const dynamic='force-dynamic';
type ProjectRow={id:string;title:string;opportunity_title:string|null;is_example:boolean|null};
type ChecklistRow={project_id:string;modality:string;created_at:string};
type TemplateCount={modality:string;total:number};
type ItemRow={id:string;title:string;guidance:string;status:'pendente'|'apresentado'|'dispensado';evidence_note:string;current_version:number};
type VersionRow={item_id:string;version:number;file_name:string;media_type:string;
 content_length:number;uploaded_at:string;note:string;full_name:string};
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
   'SELECT id,title,guidance,status,evidence_note,current_version FROM project_document_items '+
   'WHERE project_id=$1 AND municipality_id=$2 ORDER BY title,id LIMIT 200',
   [id,user.municipality_id],user.id):[];
 const enableUploads=process.env.ENABLE_DOCUMENT_UPLOADS==='yes';
 const versions=checklist&&enableUploads?await queryForMunicipality<VersionRow>(user.municipality_id,
   'SELECT v.item_id,v.version,v.file_name,v.media_type,v.content_length,v.uploaded_at,'+
   'v.note,u.full_name FROM project_document_versions v JOIN users u '+
   'ON u.id=v.uploaded_by AND u.municipality_id=v.municipality_id '+
   'WHERE v.project_id=$1 AND v.municipality_id=$2 ORDER BY v.item_id,v.version DESC LIMIT 200',
   [id,user.municipality_id],user.id):[];
 const versionsByItem=new Map<string,VersionRow[]>();
 for(const v of versions){
   const own=versionsByItem.get(v.item_id)||[];
   own.push(v);versionsByItem.set(v.item_id,own);
 }
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
      Nenhum documento é validado automaticamente. Anexos privados exigem habilitação operacional explícita.</p>
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
     <section className="document-versions" aria-label={'Histórico de versões de '+item.title}>
       <h4>Versões anexadas: {item.current_version}</h4>
       {enableUploads ? <>
        <DocumentVersionUpload projectId={id} itemId={item.id}/>
        {versionsByItem.get(item.id)?.map(version=><div className="document-version" key={version.version}>
          <a href={'/api/projects/'+id+'/documents/'+item.id+'/versions/'+version.version}>
           Baixar versão {version.version} — {version.file_name}</a>
          <p className="help">{version.full_name} · {Math.ceil(version.content_length/1024)} KiB ·
           {version.note}</p>
        </div>)}
        {!versionsByItem.get(item.id)?.length&&<p className="help">Nenhum arquivo anexado.</p>}
       </>:<p className="help">Upload e recuperação de anexos desabilitados até a homologação
        de varredura de arquivos, antivírus, retenção e controles operacionais.</p>}
     </section>
    </article>)}
    {!items.length&&<p>Nenhum documento foi inicializado. Solicite revisão do modelo.</p>}
   </section>}
  {user.role==='admin'&&<DocumentTemplateForm/>}
  <p className="note">Este checklist é um controle interno, não uma declaração de conformidade jurídica ou
   comprovação de habilitação. Verifique os documentos exigidos na versão oficial do instrumento.</p>
 </>;
}
