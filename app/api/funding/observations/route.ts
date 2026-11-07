import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {fingerprint,validDate,validOfficialUrl} from '@/lib/funding-pipeline.mjs';
export const runtime='nodejs';
const termsSchema=z.object({
 annualRateBps:z.number().int().min(0).max(10000).nullable().optional(),
 termMonths:z.number().int().min(1).max(600).nullable().optional(),
 minimumPopulation:z.number().int().min(0).max(100000000).nullable().optional(),
 requiresGuarantee:z.boolean().nullable().optional(),
 documentation:z.array(z.string().trim().min(3).max(150)).max(25).optional()
}).strict();
const schema=z.object({
 source:z.enum(['transferegov','bndes','tesouro_capag','other_official']),
 externalCode:z.string().trim().min(2).max(100),title:z.string().trim().min(6).max(220),
 sourceUrl:z.string().trim().max(500),
 modality:z.enum(['transferencia','convenio','credito','cooperacao','outro']),
 observationKind:z.enum(['programa_observado','linha_referenciada','capag_publicacao','oportunidade_conferida']),
 referenceStatus:z.enum(['nao_confirmada','conferida_por_operador','atualizacao_necessaria']),
 opensOn:z.string().nullable(),closesOn:z.string().nullable(),checkedOn:z.string().nullable(),
 evidenceNote:z.string().trim().min(15).max(1500),terms:termsSchema
}).strict();
export async function GET(){
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 const rows=await queryForMunicipality(actor.municipality_id,
  'SELECT id,source,external_code,title,source_url,modality,observation_kind,reference_status,'+
  'opens_on,closes_on,terms,checked_on,evidence_note,created_at FROM funding_observations '+
  'WHERE municipality_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',[actor.municipality_id],actor.id);
 return NextResponse.json({observations:rows},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request){
 const origin=rejectUntrustedWrite(request);if(origin)return origin;
 if(process.env.ENABLE_FUNDING_PIPELINE!=='yes')
  return NextResponse.json({error:'Jornada de captação aguardando homologação'},{status:503});
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Observação inválida'},{status:400});
 const x=parsed.data;const today=new Date().toISOString().slice(0,10);
 if(!validOfficialUrl(x.sourceUrl,x.source)||
  [x.opensOn,x.closesOn,x.checkedOn].some(d=>d!==null&&!validDate(d))||
  (x.checkedOn!==null&&x.checkedOn>today)||
  (x.opensOn&&x.closesOn&&x.opensOn>x.closesOn)||
  (x.observationKind==='oportunidade_conferida'&&
  (x.referenceStatus!=='conferida_por_operador'||!x.checkedOn)))
  return NextResponse.json({error:'Fonte HTTPS, datas ou estado incompatível'},{status:400});
 const fp=fingerprint([x.source,x.externalCode,x.title,x.sourceUrl,x.modality,
  x.observationKind,x.referenceStatus,x.opensOn,x.closesOn,x.checkedOn,x.terms,x.evidenceNote]);
 const [row]=await queryForMunicipality<{id:string}>(actor.municipality_id,
  'INSERT INTO funding_observations(municipality_id,source,external_code,title,source_url,'+
  'modality,observation_kind,reference_status,opens_on,closes_on,checked_on,terms,evidence_note,fingerprint,created_by) '+
  'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15) '+
  'ON CONFLICT (municipality_id,source,external_code,fingerprint) DO UPDATE SET '+
  'fingerprint=EXCLUDED.fingerprint RETURNING id',
  [actor.municipality_id,x.source,x.externalCode,x.title,x.sourceUrl,
   x.modality,x.observationKind,x.referenceStatus,x.opensOn,x.closesOn,x.checkedOn,
   JSON.stringify(x.terms),x.evidenceNote,fp,actor.id],actor.id);
 if(!row)return NextResponse.json({error:'Observação idêntica já registrada'},{status:409});
 return NextResponse.json({id:row.id,scope:'declaracao_municipal_sem_certificacao'},{
  status:201,headers:{'cache-control':'no-store'}});
}
