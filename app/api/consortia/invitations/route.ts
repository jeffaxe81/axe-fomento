import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {INVITE_CONSORTIUM_MEMBER_SQL} from '@/lib/consortium-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 consortiumId:z.string().uuid(),municipalityId:z.string().uuid(),
 note:z.string().trim().min(10).max(500)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_CONSORTIUMS!=='yes')
  return NextResponse.json({error:'Convites aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão necessária'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Convite inválido'},{status:400});
 const x=p.data;
 let result:{eligible:boolean;id:string|null;logged:boolean}|undefined;
 try{[result]=await queryForMunicipality<{eligible:boolean;id:string|null;logged:boolean}>(
  actor.municipality_id,INVITE_CONSORTIUM_MEMBER_SQL,
  [actor.municipality_id,actor.id,x.consortiumId,x.municipalityId,x.note],actor.id);
 }catch(error){
  if(error&&typeof error==='object'&&'code' in error&&error.code==='23503')
   return NextResponse.json({error:'Município convidado não encontrado'},{status:404});
  throw error;
 }
 if(!result?.eligible)return NextResponse.json({error:'Consórcio ou município indisponível'},{status:404});
 if(!result.id||!result.logged)return NextResponse.json({error:'Convite já existente'},{status:409});
 return NextResponse.json({membershipId:result.id,state:'invited'},
  {status:201,headers:{'cache-control':'no-store'}});
}
