import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {radarReferenceDate} from '@/lib/opportunity-deadline.mjs';
import {isEvidenceUrl} from '@/lib/pilot-gates.mjs';
export const runtime='nodejs';
const schema=z.object({
 evidenceId:z.string().uuid(),decision:z.enum(['accepted','rejected']),
 acceptanceUrl:z.string().trim().max(500).nullable(),
 notes:z.string().trim().min(30).max(1500),reviewedOn:z.string()
}).strict();
export async function POST(request:Request){
 const bad=rejectUntrustedWrite(request);if(bad)return bad;
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 if(process.env.ENABLE_PILOT_REVIEW!=='yes')
  return NextResponse.json({error:'Revisão independente ainda não habilitada'},{status:503});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Revisão inválida'},{status:400});
 const x=parsed.data, today=radarReferenceDate().toISOString().slice(0,10);
 if(!/^\d{4}-\d\d-\d\d$/.test(x.reviewedOn)||!Number.isFinite(Date.parse(x.reviewedOn+'T00:00:00Z'))||
  new Date(x.reviewedOn+'T00:00:00Z').toISOString().slice(0,10)!==x.reviewedOn||
  x.reviewedOn>today||(x.acceptanceUrl!==null&&!isEvidenceUrl(x.acceptanceUrl))||
  (x.decision==='accepted'&&!x.acceptanceUrl))
  return NextResponse.json({error:'Data ou documento de aceite inválido'},{status:400});
 const [evidence]=await queryForMunicipality<{created_by:string}>(actor.municipality_id,
  'SELECT created_by FROM pilot_gate_evidence WHERE municipality_id=$1 AND id=$2',
  [actor.municipality_id,x.evidenceId],actor.id);
 if(!evidence)return NextResponse.json({error:'Evidência indisponível'},{status:404});
 if(evidence.created_by===actor.id)
  return NextResponse.json({error:'Revisão por segundo administrador obrigatória'},{status:409});
 const [row]=await queryForMunicipality<{id:string}>(actor.municipality_id,
  'INSERT INTO pilot_gate_reviews(municipality_id,evidence_id,evidence_author_id,'+
  'reviewed_by,decision,acceptance_url,notes,reviewed_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8) '+
  'ON CONFLICT(evidence_id,reviewed_by) DO NOTHING RETURNING id',
  [actor.municipality_id,x.evidenceId,evidence.created_by,actor.id,x.decision,
   x.acceptanceUrl,x.notes,x.reviewedOn],actor.id);
 if(!row)return NextResponse.json({error:'Esta revisão já foi registrada'},{status:409});
 return NextResponse.json({id:row.id,decision:x.decision,
  productionAuthorization:false,
  notice:'Aceite interno de segundo administrador registrado; liberação para produção exige autorização formal separada.'},
  {status:201,headers:{'cache-control':'no-store'}});
}
