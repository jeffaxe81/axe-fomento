import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {validateDate} from '@/lib/document-validity.mjs';
import {CREATE_PROTOCOL_DILIGENCE_SQL} from '@/lib/protocol-diligence-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),protocolId:z.string().uuid(),assignedTo:z.string().uuid(),
 title:z.string().trim().min(5).max(180),
 details:z.string().trim().min(10).max(1200),
 dueOn:z.string()
}).strict();
export async function POST(request:Request){
 const rejection=rejectUntrustedWrite(request);if(rejection)return rejection;
 if(process.env.ENABLE_DILIGENCE_RECORDS!=='yes')
  return NextResponse.json({error:'Diligências desabilitadas até homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let payload:unknown;
 try{payload=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const parsed=schema.safeParse(payload);
 if(!parsed.success||!validateDate(parsed.data?.dueOn)||
    parsed.data.dueOn<'2000-01-01'||parsed.data.dueOn>'2100-12-31')
  return NextResponse.json({error:'Dados ou prazo da diligência inválidos'},{status:400});
 const d=parsed.data;
 const [saved]=await queryForMunicipality<{id:string|null;created:boolean}>(
  actor.municipality_id,CREATE_PROTOCOL_DILIGENCE_SQL,
  [actor.municipality_id,d.projectId,d.protocolId,d.assignedTo,
   d.title,d.details,d.dueOn,actor.id],actor.id);
 if(!saved?.created)return NextResponse.json(
  {error:'Protocolo ou responsável indisponível para este município'},{status:404});
 return NextResponse.json({id:saved.id},{status:201,headers:{'cache-control':'no-store'}});
}
