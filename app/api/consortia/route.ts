import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {CREATE_CONSORTIUM_SQL} from '@/lib/consortium-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 title:z.string().trim().min(6).max(160),
 purpose:z.string().trim().min(20).max(800)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_CONSORTIUMS!=='yes')
  return NextResponse.json({error:'Consórcios aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão necessária'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Dados de consórcio inválidos'},{status:400});
 const [result]=await queryForMunicipality<{eligible:boolean;id:string|null}>(
  actor.municipality_id,CREATE_CONSORTIUM_SQL,
  [actor.municipality_id,actor.id,p.data.title,p.data.purpose],actor.id);
 if(!result?.eligible)return NextResponse.json({error:'Administrador não autorizado'},{status:403});
 if(!result.id)return NextResponse.json({error:'Consórcio já cadastrado'},{status:409});
 return NextResponse.json({id:result.id},{status:201,headers:{'cache-control':'no-store'}});
}
