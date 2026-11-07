import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {CREATE_CONSORTIUM_SHARE_SQL} from '@/lib/consortium-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 consortiumId:z.string().uuid(),projectId:z.string().uuid(),
 publicTitle:z.string().trim().min(6).max(160),
 sharedSummary:z.string().trim().min(40).max(2000),
 note:z.string().trim().min(10).max(500)
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_CONSORTIUM_SHARING!=='yes')
  return NextResponse.json({error:'Compartilhamento aguardando homologação'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão necessária'},{status:401});
 let body:unknown;try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const p=schema.safeParse(body);
 if(!p.success)return NextResponse.json({error:'Resumo inválido'},{status:400});
 const x=p.data;
 const [result]=await queryForMunicipality<{eligible:boolean;id:string|null;logged:boolean}>(
  actor.municipality_id,CREATE_CONSORTIUM_SHARE_SQL,[
   actor.municipality_id,actor.id,x.consortiumId,x.projectId,
   x.publicTitle,x.sharedSummary,x.note
  ],actor.id);
 if(!result?.eligible)return NextResponse.json({error:'Projeto ou consórcio indisponível'},{status:404});
 if(!result.id||!result.logged)return NextResponse.json({error:'Projeto já compartilhado'},{status:409});
 return NextResponse.json({id:result.id,sharedScope:'somente_resumo_autorizado'},
  {status:201,headers:{'cache-control':'no-store'}});
}
