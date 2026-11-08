import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {REPLY_PROTOCOL_DILIGENCE_SQL} from '@/lib/protocol-diligence-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 diligenceId:z.string().uuid(),
 expectedRevision:z.number().int().min(1).max(9999),
 proofVersionId:z.string().uuid(),
 responseText:z.string().trim().min(10).max(1500)
}).strict();
export async function PATCH(request:Request){
 const rejection=rejectUntrustedWrite(request);if(rejection)return rejection;
 if(process.env.ENABLE_DILIGENCE_RECORDS!=='yes')
  return NextResponse.json({error:'Diligências desabilitadas até homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let payload:unknown;
 try{payload=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const parsed=schema.safeParse(payload);
 if(!parsed.success)return NextResponse.json({error:'Resposta inválida'},{status:400});
 const d=parsed.data;
 const [result]=await queryForMunicipality<{
  eligible:boolean;current_revision:number|null;changed:boolean
 }>(actor.municipality_id,REPLY_PROTOCOL_DILIGENCE_SQL,
  [actor.municipality_id,d.diligenceId,actor.id,
   d.proofVersionId,d.expectedRevision,d.responseText],actor.id);
 if(!result?.eligible)return NextResponse.json(
  {error:'Diligência ou comprovante não disponível para este responsável'},{status:404});
 if(!result.changed)return NextResponse.json(
  {error:'Diligência já respondida ou revisão desatualizada'},{status:409});
 return NextResponse.json({revision:d.expectedRevision+1,changed:true},
  {status:200,headers:{'cache-control':'no-store'}});
}
