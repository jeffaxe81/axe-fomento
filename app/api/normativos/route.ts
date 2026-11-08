import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {validNormativeVersion} from '@/lib/normative-source.mjs';
import {CREATE_NORMATIVE_SOURCE_SQL} from '@/lib/normative-source-sql.mjs';
export const runtime='nodejs';

const schema=z.object({
 referenceCode:z.string().trim().min(3).max(100).regex(/^[A-Z0-9][A-Z0-9./ -]{2,99}$/),
 title:z.string().trim().min(5).max(180),
 jurisdiction:z.enum(['federal','estadual','municipal']),
 stateUf:z.string().trim().max(2),
 sourceUrl:z.string().trim().min(12).max(500),
 publishedOn:z.string(),validFrom:z.string(),validUntil:z.string().nullable(),
 sourceSection:z.string().trim().min(2).max(120),
 excerpt:z.string().trim().min(10).max(1200),
 contextNote:z.string().trim().min(10).max(1000),
}).strict().superRefine((data,ctx)=>{
 if(data.jurisdiction==='estadual'&&!/^[A-Z]{2}$/.test(data.stateUf))
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['stateUf'],
   message:'UF da norma estadual é obrigatória'});
 if(data.jurisdiction!=='estadual'&&data.stateUf!=='')
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['stateUf'],
   message:'UF municipal é derivada da prefeitura; norma federal não informa UF'});
});

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
 if(!parsed.success)return NextResponse.json({error:'Dados normativos inválidos'},{status:400});
 const x=parsed.data;
 const v=validNormativeVersion(x);
 if(!v)return NextResponse.json({error:'Origem HTTPS pública, data ou vigência inválida'},{status:400});
 const [result]=await queryForMunicipality<{
  eligible:boolean;id:string|null;created:boolean
 }>(user.municipality_id,CREATE_NORMATIVE_SOURCE_SQL,[
  user.municipality_id,user.id,x.referenceCode,x.title,x.jurisdiction,
  x.jurisdiction==='estadual'?x.stateUf:null,
  v.sourceUrl,v.publishedOn,v.validFrom,v.validUntil,
  x.sourceSection,x.excerpt,x.contextNote
 ],user.id);
 if(!result?.eligible)return NextResponse.json({error:'Operação não autorizada'},{status:403});
 if(!result.created)return NextResponse.json({
  error:'Já existe uma referência com esse código neste município'
 },{status:409});
 return NextResponse.json({id:result.id,version:1},
  {status:201,headers:{'cache-control':'no-store'}});
}
