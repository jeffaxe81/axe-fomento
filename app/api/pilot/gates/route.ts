import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {radarReferenceDate} from '@/lib/opportunity-deadline.mjs';
import {PILOT_GATES,isEvidenceUrl,pilotEvidenceSummary} from '@/lib/pilot-gates.mjs';
export const runtime='nodejs';
type Row={id:string;gate_id:string;result_claimed:string;environment_label:string;
 evidence_url:string;evidence_sha256:string|null;performed_on:string;notes:string;created_by:string;created_at:string};
type Review={evidence_id:string;reviewed_by:string;decision:string;acceptance_url:string|null;created_at:string};
const schema=z.object({
 gateId:z.enum(['OP-01','OP-02','OP-03','OP-04','OP-05','OP-06','OP-07','OP-08']),
 environmentLabel:z.string().trim().min(5).max(100),
 resultClaimed:z.enum(['pass','fail','blocked']),
 evidenceUrl:z.string().trim().max(500),
 evidenceSha256:z.string().regex(/^[a-f0-9]{64}$/).nullable(),
 performedOn:z.string(),notes:z.string().trim().min(30).max(1500)
}).strict();
export async function GET(){
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 const evidence=await queryForMunicipality<Row>(actor.municipality_id,
  'SELECT id,gate_id,result_claimed,environment_label,evidence_url,evidence_sha256,'+
  'performed_on::text AS performed_on,notes,created_by,created_at FROM pilot_gate_evidence '+
  'WHERE municipality_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',
  [actor.municipality_id],actor.id);
 const reviews=await queryForMunicipality<Review>(actor.municipality_id,
  'SELECT evidence_id,reviewed_by,decision,acceptance_url,created_at '+
  'FROM pilot_gate_reviews WHERE municipality_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',
  [actor.municipality_id],actor.id);
 return NextResponse.json({gates:PILOT_GATES,evidence,reviews,summary:pilotEvidenceSummary(evidence,reviews),
  independentAcceptance:'pendente',enabled:process.env.ENABLE_PILOT_EVIDENCE==='yes'},{
  headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 if(process.env.ENABLE_PILOT_EVIDENCE!=='yes')
  return NextResponse.json({error:'Registro de evidências do piloto em homologação'},{status:503});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Evidência inválida'},{status:400});
 const x=parsed.data,today=radarReferenceDate().toISOString().slice(0,10);
 if(!/^\d{4}-\d\d-\d\d$/.test(x.performedOn)||
  !Number.isFinite(Date.parse(x.performedOn+'T00:00:00Z'))||
  new Date(x.performedOn+'T00:00:00Z').toISOString().slice(0,10)!==x.performedOn||
  x.performedOn>today||!isEvidenceUrl(x.evidenceUrl))
  return NextResponse.json({error:'Data de execução ou URL de evidência incompatível'},{status:400});
 const [row]=await queryForMunicipality<{id:string}>(actor.municipality_id,
  'INSERT INTO pilot_gate_evidence(municipality_id,gate_id,environment_label,result_claimed,'+
  'evidence_url,evidence_sha256,performed_on,notes,created_by) '+
  'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
  [actor.municipality_id,x.gateId,x.environmentLabel,x.resultClaimed,x.evidenceUrl,
   x.evidenceSha256,x.performedOn,x.notes,actor.id],actor.id);
 return NextResponse.json({id:row.id,gate:x.gateId,recorded:true,approved:false,
  decision:'NO-GO',message:'Evidência municipal registrada. Revisão e aceite independentes obrigatórios.'},
  {status:201,headers:{'cache-control':'no-store'}});
}
