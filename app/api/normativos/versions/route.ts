import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {validNormativeVersion} from '@/lib/normative-source.mjs';
import {ADD_NORMATIVE_VERSION_SQL} from '@/lib/normative-source-sql.mjs';
export const runtime='nodejs';

const schema=z.object({
 sourceId:z.string().uuid(),
 expectedVersion:z.number().int().min(1).max(999),
 sourceUrl:z.string().trim().min(12).max(500),
 publishedOn:z.string(),validFrom:z.string(),validUntil:z.string().nullable(),
 sourceSection:z.string().trim().min(2).max(120),
 excerpt:z.string().trim().min(10).max(1200),
 contextNote:z.string().trim().min(10).max(1000),
}).strict();

export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_NORMATIVE_REGISTRY!=='yes')
  return NextResponse.json({error:'Base normativa aguardando homologação'},{status:503});
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Acesso não autorizado'},{status:403});
 let body:unknown;
 try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Versão normativa inválida'},{status:400});
 const x=parsed.data;
 const v=validNormativeVersion(x);
 if(!v)return NextResponse.json({error:'Origem HTTPS pública, data ou vigência inválida'},{status:400});
 const [result]=await queryForMunicipality<{
  eligible:boolean;current_version:number|null;id:string|null;version:number|null
 }>(user.municipality_id,ADD_NORMATIVE_VERSION_SQL,[
  user.municipality_id,user.id,x.sourceId,x.expectedVersion,
  v.sourceUrl,v.publishedOn,v.validFrom,v.validUntil,
  x.sourceSection,x.excerpt,x.contextNote
 ],user.id);
 if(!result?.eligible)return NextResponse.json({
  error:'Referência normativa não encontrada neste município'
 },{status:404});
 if(!result.id)return NextResponse.json({
  error:'Versão anterior divergente ou limite de versões alcançado'
 },{status:409});
 return NextResponse.json({id:result.id,version:result.version},
  {status:201,headers:{'cache-control':'no-store'}});
}
