import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {fingerprint,validDate,validOfficialUrl,parseMoneyCents,EVENT_TYPES} from '@/lib/funding-pipeline.mjs';
export const runtime='nodejs';
const schema=z.object({
 caseId:z.string().uuid(),expectedRevision:z.number().int().min(0).max(9999),
 eventKind:z.enum([
  'eligibility','line_comparison','financial_simulation','documentation_check',
  'dossier','submission_handoff','protocol_update','diligence_alert',
  'award_verification','disbursement_verification','decision_review']),
 note:z.string().trim().min(15).max(1500),
 evidenceUrl:z.string().max(500).nullable(),eventDate:z.string().nullable(),
 value:z.string().nullable(),content:z.record(z.unknown())
}).strict();
export async function GET(request:Request){
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 const id=new URL(request.url).searchParams.get('caseId');
 if(!id||!z.string().uuid().safeParse(id).success)return NextResponse.json({error:'caseId inválido'},{status:400});
 const events=await queryForMunicipality(actor.municipality_id,
  'SELECT e.id,e.event_kind,e.revision,e.note,e.evidence_url,e.value_cents,e.event_date,'+
  'e.content,e.fingerprint,e.created_at FROM funding_case_events e '+
  'JOIN funding_cases c ON c.id=e.case_id AND c.municipality_id=$1 '+
  'WHERE e.municipality_id=$1 AND e.case_id=$2 ORDER BY e.revision DESC LIMIT 150',
  [actor.municipality_id,id],actor.id);
 return NextResponse.json({events},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request){
 const origin=rejectUntrustedWrite(request);if(origin)return origin;
 if(process.env.ENABLE_FUNDING_PIPELINE!=='yes')return NextResponse.json({error:'Módulo em homologação'},{status:503});
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Evento inválido'},{status:400});
 const x=parsed.data;
 if(!EVENT_TYPES.includes(x.eventKind)||x.eventDate!==null&&!validDate(x.eventDate)||
  x.evidenceUrl!==null&&!validOfficialUrl(x.evidenceUrl,'other_official')&&
   !validOfficialUrl(x.evidenceUrl,'transferegov')&&
   !validOfficialUrl(x.evidenceUrl,'bndes')&&
   !validOfficialUrl(x.evidenceUrl,'tesouro_capag'))
  return NextResponse.json({error:'Data ou referência institucional inválida'},{status:400});
 const money=x.value===null?null:parseMoneyCents(x.value);
 if(x.value!==null&&money===null)return NextResponse.json({error:'Valor monetário inválido'},{status:400});
 if(['award_verification','disbursement_verification'].includes(x.eventKind)&&
    (!x.evidenceUrl||!money||BigInt(money)===0n))
  return NextResponse.json({error:'Registro financeiro requer valor positivo e URL de evidência pública'},{status:400});
 const payload=JSON.stringify(x.content);
 if(payload.length>5000)return NextResponse.json({error:'Detalhamento excede limite'},{status:400});
 const fp=fingerprint([x.caseId,x.expectedRevision+1,x.eventKind,x.note,x.evidenceUrl,x.eventDate,money,x.content]);
 const sql=`
 WITH mutex AS MATERIALIZED(SELECT pg_advisory_xact_lock(hashtext($2::uuid::text)) AS acquired),
 permitted AS MATERIALIZED(
  SELECT c.id FROM funding_cases c JOIN projects p ON p.id=c.project_id AND p.municipality_id=$1
  WHERE c.id=$2 AND c.municipality_id=$1 AND
   (p.owner_user_id=$3 OR EXISTS(SELECT 1 FROM users u WHERE u.id=$3 AND u.role='admin' AND u.active))
 ), latest AS MATERIALIZED(
  SELECT COALESCE(MAX(e.revision),0)::int AS revision FROM mutex
  LEFT JOIN funding_case_events e ON e.case_id=$2 AND e.municipality_id=$1
 )
 INSERT INTO funding_case_events(municipality_id,case_id,created_by,revision,
  event_kind,note,evidence_url,event_date,value_cents,content,fingerprint)
 SELECT $1,c.id,$3,latest.revision+1,$5,$6,$7,$8,$9,$10::jsonb,$11
 FROM permitted c CROSS JOIN latest WHERE latest.revision=$4 RETURNING id,revision`;
 const [row]=await queryForMunicipality<{id:string;revision:number}>(actor.municipality_id,sql,
  [actor.municipality_id,x.caseId,actor.id,x.expectedRevision,x.eventKind,x.note,
   x.evidenceUrl,x.eventDate,money,payload,fp],actor.id);
 if(!row)return NextResponse.json({error:'Vínculo indisponível, sem permissão ou versão concorrente'},{status:409});
 return NextResponse.json({id:row.id,revision:row.revision,
  notice:'Registro interno não é confirmação automática de aprovação, protocolo ou pagamento'},{
  status:201,headers:{'cache-control':'no-store'}});
}
