import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {normalizePortal,validProtocolDate} from '@/lib/external-protocol.mjs';
import {CREATE_COOPERATION_CALL_SQL} from '@/lib/cooperation-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 code:z.string().trim().min(3).max(60).regex(/^[A-Z0-9][A-Z0-9_-]{2,59}$/),
 title:z.string().trim().min(6).max(180),
 institution:z.string().trim().min(4).max(160),
 language:z.enum(['pt','en','es','fr','other']),
 scope:z.enum(['municipal','regional','national','international','to_confirm']),
 modality:z.enum(['loan','grant','technical_cooperation','guarantee','to_confirm']),
 officialUrl:z.string().min(12).max(500),
 reviewState:z.enum(['to_verify','checked_reference','review_required']),
 checkedOn:z.string().nullable(),
 notes:z.string().trim().min(20).max(1000)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_INTERNATIONAL_COOPERATION!=='yes')
  return NextResponse.json({error:'Radar aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão necessária'},{status:401});
 if(actor.role!=='admin')return NextResponse.json({error:'Somente administrador municipal'},{status:403});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Cadastro inválido'},{status:400});
 const x=p.data,url=normalizePortal(x.officialUrl);
 if(!url||(x.checkedOn!==null&&!validProtocolDate(x.checkedOn))||
  (x.reviewState==='checked_reference'&&x.checkedOn===null))
  return NextResponse.json({error:'Link público HTTPS ou data de consulta inválida'},{status:422});
 const [result]=await queryForMunicipality<{eligible:boolean;id:string|null}>(
  actor.municipality_id,CREATE_COOPERATION_CALL_SQL,[
   actor.municipality_id,actor.id,x.code,x.title,x.institution,x.language,x.scope,
   x.modality,url.url,x.reviewState,x.checkedOn,x.notes
  ],actor.id);
 if(!result?.eligible)return NextResponse.json({error:'Administrador inativo'},{status:403});
 if(!result.id)return NextResponse.json({error:'Código já cadastrado no município'},{status:409});
 return NextResponse.json({id:result.id,scope:'referencia_municipal_nao_verificada_automaticamente'},
  {status:201,headers:{'cache-control':'no-store'}});
}
