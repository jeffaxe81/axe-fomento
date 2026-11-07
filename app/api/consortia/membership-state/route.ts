import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {CHANGE_CONSORTIUM_MEMBERSHIP_SQL} from '@/lib/consortium-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 membershipId:z.string().uuid(),action:z.enum(['accept','decline','revoke']),
 expectedRevision:z.number().int().min(1).max(999),
 note:z.string().trim().min(10).max(500)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_CONSORTIUMS!=='yes')
  return NextResponse.json({error:'Participação aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão necessária'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Transição inválida'},{status:400});
 const x=p.data;
 const [result]=await queryForMunicipality<{eligible:boolean;id:string|null;logged:boolean}>(
  actor.municipality_id,CHANGE_CONSORTIUM_MEMBERSHIP_SQL,[
   actor.municipality_id,actor.id,x.membershipId,x.action,x.expectedRevision,x.note
  ],actor.id);
 if(!result?.eligible)return NextResponse.json({error:'Administrador inativo'},{status:403});
 if(!result.id||!result.logged)return NextResponse.json({
  error:'Participação indisponível, decisão sem permissão ou versão desatualizada'
 },{status:409});
 return NextResponse.json({membershipId:result.id,action:x.action},
  {status:201,headers:{'cache-control':'no-store'}});
}
