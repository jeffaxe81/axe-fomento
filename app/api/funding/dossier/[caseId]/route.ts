import {NextResponse} from 'next/server';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {radarReferenceDate} from '@/lib/opportunity-deadline.mjs';
import {classifyObservation} from '@/lib/funding-pipeline.mjs';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{caseId:string}>}){
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 const {caseId}=await params;
 if(!z.string().uuid().safeParse(caseId).success)return NextResponse.json({error:'ID inválido'},{status:400});
 const [row]=await queryForMunicipality<{
  id:string;project_title:string;offer_title:string;source:string;source_url:string;
  observation_kind:string;reference_status:string;external_code:string;checked_on:string|null;
  opens_on:string|null;closes_on:string|null;terms:Record<string,unknown>;is_superseded:boolean
 }>(actor.municipality_id,
  'SELECT c.id,p.title AS project_title,o.title AS offer_title,o.source,o.source_url,'+
  'o.observation_kind,o.reference_status,o.external_code,o.terms,'+
  'o.checked_on::text AS checked_on,o.opens_on::text AS opens_on,o.closes_on::text AS closes_on,'+
  'EXISTS(SELECT 1 FROM funding_observations newer WHERE newer.municipality_id=o.municipality_id '+
  'AND newer.source=o.source AND newer.external_code=o.external_code '+
  'AND (newer.created_at,newer.id)>(o.created_at,o.id)) AS is_superseded FROM funding_cases c '+
  'JOIN projects p ON p.id=c.project_id AND p.municipality_id=c.municipality_id '+
  'JOIN funding_observations o ON o.id=c.observation_id AND o.municipality_id=c.municipality_id '+
  'WHERE c.id=$2 AND c.municipality_id=$1',
  [actor.municipality_id,caseId],actor.id);
 if(!row)return NextResponse.json({error:'Dossiê não encontrado'},{status:404});
 const events=await queryForMunicipality<{event_kind:string;revision:number;note:string;
  evidence_url:string|null;value_cents:string|null;event_date:string|null;fingerprint:string}>(
  actor.municipality_id,
  'SELECT event_kind,revision,note,evidence_url,value_cents,event_date,fingerprint '+
  'FROM funding_case_events WHERE municipality_id=$1 AND case_id=$2 ORDER BY revision ASC LIMIT 100',
  [actor.municipality_id,caseId],actor.id);
 const today=radarReferenceDate().toISOString().slice(0,10);
 const currentStatus=classifyObservation(row,today);
 const noticeUnavailable=row.is_superseded||currentStatus!=='potencialmente_aberta_verificar_fonte';
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 pdf.setSubject(noticeUnavailable?'ALERTA: FONTE DESATUALIZADA, SUBSTITUIDA OU SEM VIGENCIA COMPROVADA':
  'DOSSIÊ INTERNO - VIGENCIA A RECONFIRMAR NA FONTE OFICIAL');
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=595,H=842;let page=pdf.addPage([W,H]),y=H-52;
 const clean=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^\u0020-\u007e]/g,' ').slice(0,1500);
 function line(s:string,strong=false){
  const value=clean(s);
  for(let pos=0;pos<value.length||pos===0;pos+=95){
   if(y<65){page=pdf.addPage([W,H]);y=H-48;}
   page.drawText(value.slice(pos,pos+95),{x:45,y,size:strong?12:9,
    font:strong?bold:font,color:rgb(0.13,0.20,0.31)});
   y-=strong?22:16;
  }
 }
 line('AXE FOMENTO — DOSSIÊ INTERNO DE PREPARAÇÃO',true);
 line('SEM VALIDADE DE PROTOCOLO, PARECER JURIDICO OU APROVACAO DO FINANCIADOR');
 if(noticeUnavailable)line('ALERTA: FONTE SUBSTITUIDA, DESATUALIZADA OU SEM PRAZO ATUAL COMPROVADO',true);
 else line('VIGENCIA INFORMADA PELO MUNICIPIO - RECONFIRMAR ANTES DE ENVIAR',true);
 y-=6;line('Projeto: '+row.project_title,true);line('Referência: '+row.offer_title);
 line('Origem: '+row.source+' / '+row.observation_kind+' / '+row.reference_status);
 line('Fonte de consulta: '+row.source_url);
 line('ID interno: '+caseId);line('Gerado em: '+new Date().toISOString());
 y-=15;line('Histórico e evidências declaradas',true);
 if(!events.length)line('Não existem eventos de candidatura registrados.');
 for(const e of events){
  y-=6;line('Revisão '+e.revision+' — '+e.event_kind,true);
  line(e.note);
  if(e.event_date)line('Data informada: '+String(e.event_date).slice(0,10));
  if(e.value_cents)line('Valor declarado em centavos: '+e.value_cents);
  if(e.evidence_url)line('Referência informada: '+e.evidence_url);
  line('SHA-256 de registro: '+e.fingerprint);
 }
 const bytes=await pdf.save();
 return new NextResponse(Buffer.from(bytes),{headers:{
  'content-type':'application/pdf',
  'content-disposition':'attachment; filename="axe-fomento-dossie-interno.pdf"',
  'cache-control':'private, no-store','x-content-type-options':'nosniff'
 }});
}
