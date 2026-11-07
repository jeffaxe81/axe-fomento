import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {query,queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {fetchOfficialPrograms} from '@/lib/source-ingestion';
import {fetchCapagCatalog} from '@/lib/capag-publications.mjs';
import {fingerprint} from '@/lib/funding-pipeline.mjs';
export const runtime='nodejs';
const schema=z.object({source:z.enum(['transferegov','bndes','tesouro_capag'])}).strict();
type Observation={source:string;externalCode:string;title:string;sourceUrl:string;
 modality:string;observationKind:string;evidenceNote:string};
export async function POST(request:Request){
 const badOrigin=rejectUntrustedWrite(request);if(badOrigin)return badOrigin;
 if(process.env.ENABLE_FUNDING_PIPELINE!=='yes')
  return NextResponse.json({error:'Módulo de captação aguardando homologação'},{status:503});
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Fonte inválida'},{status:400});
 const source=parsed.data.source;let batch:Observation[]=[];
 if(source==='transferegov'){
  if(process.env.ENABLE_OFFICIAL_SOURCE_SYNC!=='yes')
   return NextResponse.json({error:'Integração Transferegov não homologada'},{status:503});
  try{
   const programs=await fetchOfficialPrograms();
   batch=programs.map(p=>({source,externalCode:p.externalId,title:p.title,
    sourceUrl:p.sourceUrl,modality:'convenio',observationKind:'programa_observado',
    evidenceNote:'Registro observado em fonte de dados abertos; não é edital vigente nem autorização financeira.'}));
  }catch{
   return NextResponse.json({error:'Falha na coleta da fonte; nenhuma oferta considerada aberta'},{status:502});
  }
 }else if(source==='bndes'){
  const entries=await query<{code:string;title:string;source_url:string}>(
   'SELECT code,title,source_url FROM bndes_city_solutions ORDER BY title LIMIT 100');
  batch=entries.map(x=>({source,externalCode:x.code,title:x.title,sourceUrl:x.source_url,
   modality:'credito',observationKind:'linha_referenciada',
   evidenceNote:'Referência editorial de catálogo; condições e disponibilidade devem ser conferidas no BNDES.'}));
 }else{
  let resources;
  try{resources=await fetchCapagCatalog();}
  catch{return NextResponse.json({error:'Falha na consulta de metadados oficiais CAPAG'}, {status:502});}
  batch=resources.slice(0,20).map(r=>({source,
   externalCode:r.resourceId||'capag-'+String(r.publishedForYear),
   title:r.name,sourceUrl:r.url,modality:'credito',
   observationKind:'capag_publicacao',
   evidenceNote:'Arquivo público do Tesouro. Ano da publicação '+(r.publishedForYear??'não apurado')+
    ', data indicada '+(r.publicationDate??'não informada')+
    '. Não é classificação individual nem autorização para financiamento.'}));

 }
 let added=0;
 for(const item of batch){
  const hash=fingerprint([item.source,item.externalCode,item.title,item.sourceUrl,item.modality,item.observationKind]);
  const rows=await queryForMunicipality<{id:string}>(actor.municipality_id,
   'INSERT INTO funding_observations(municipality_id,source,external_code,title,source_url,modality,'+
   'observation_kind,reference_status,terms,evidence_note,fingerprint,created_by) '+
   'VALUES($1,$2,$3,$4,$5,$6,$7,\'nao_confirmada\',\'{}\'::jsonb,$8,$9,$10) '+
   'ON CONFLICT (municipality_id,source,external_code,fingerprint) DO NOTHING RETURNING id',
   [actor.municipality_id,item.source,item.externalCode,item.title,item.sourceUrl,
    item.modality,item.observationKind,item.evidenceNote,hash,actor.id],actor.id);
  if(rows.length)added++;
 }
 return NextResponse.json({source,observed:batch.length,added,
  scope:'referencias_sem_confirmacao_de_oferta',requiresHumanReview:true},
  {headers:{'cache-control':'no-store'}});
}
