import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {normalizePortal,validProtocolDate} from '@/lib/external-protocol.mjs';
import {CREATE_APPLICATION_ROUTE_SQL} from '@/lib/cooperation-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 callId:z.string().uuid(),
 routeType:z.enum(['direct','intermediated','to_confirm']),
 contactName:z.string().trim().min(5).max(160),
 contactUrl:z.string().min(12).max(500),
 verification:z.enum(['reported','checked_internally','review_required']),
 checkedOn:z.string().nullable(),
 applicationSteps:z.string().trim().min(25).max(1200)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_INTERNATIONAL_COOPERATION!=='yes')
  return NextResponse.json({error:'Rotas aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão necessária'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Rota inválida'},{status:400});
 const x=p.data,url=normalizePortal(x.contactUrl);
 if(!url||(x.checkedOn!==null&&!validProtocolDate(x.checkedOn))||
  (x.verification==='checked_internally'&&x.checkedOn===null))
  return NextResponse.json({error:'Contato público ou conferência inválida'},{status:422});
 const [result]=await queryForMunicipality<{eligible:boolean;id:string|null}>(
  actor.municipality_id,CREATE_APPLICATION_ROUTE_SQL,[
   actor.municipality_id,actor.id,x.callId,x.routeType,x.contactName,
   url.url,x.verification,x.checkedOn,x.applicationSteps
  ],actor.id);
 if(!result?.eligible)return NextResponse.json({error:'Chamada não encontrada'},{status:404});
 if(!result.id)return NextResponse.json({error:'Rota duplicada'},{status:409});
 return NextResponse.json({id:result.id,scope:'rota_informada_nao_homologada'},
  {status:201,headers:{'cache-control':'no-store'}});
}
