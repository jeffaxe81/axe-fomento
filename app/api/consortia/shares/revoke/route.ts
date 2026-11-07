import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {REVOKE_CONSORTIUM_SHARE_SQL} from '@/lib/consortium-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 shareId:z.string().uuid(),expectedRevision:z.number().int().min(1).max(999),
 note:z.string().trim().min(10).max(500)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_CONSORTIUM_SHARING!=='yes')
  return NextResponse.json({error:'Revogação aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão necessária'},{status:401});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Revogação inválida'},{status:400});
 const x=p.data;
 const [result]=await queryForMunicipality<{id:string|null;logged:boolean}>(
  actor.municipality_id,REVOKE_CONSORTIUM_SHARE_SQL,
  [actor.municipality_id,actor.id,x.shareId,x.expectedRevision,x.note],actor.id);
 if(!result?.id||!result.logged)return NextResponse.json({
  error:'Resumo indisponível, sem permissão ou versão desatualizada'
 },{status:409});
 return NextResponse.json({id:result.id,enabled:false},
  {status:201,headers:{'cache-control':'no-store'}});
}
