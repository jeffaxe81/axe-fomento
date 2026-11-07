import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { UPSERT_CAPAG_SQL } from '@/lib/capag-upsert-sql.mjs';

export const runtime='nodejs';
const schema=z.object({
 classification:z.enum(['A+','A','B+','B','C','D','N.D.']),
 baseYear:z.number().int().min(2017).max(2100),
 referenceDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 officialUrl:z.string().url().max(600).refine((value)=>{
   try {const u=new URL(value);
     return u.protocol==='https:' && !u.username && !u.password &&
       ['tesourotransparente.gov.br','www.tesourotransparente.gov.br','gov.br','www.gov.br'].includes(u.hostname);
   }catch{return false;}
 }),
 sourceLabel:z.string().trim().min(5).max(180),
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);
 if(blocked)return blocked;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Permissão insuficiente'},{status:403});
 let input:unknown;
 try{input=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const parsed=schema.safeParse(input);
 if(!parsed.success)return NextResponse.json({error:'Referência CAPAG inválida'},{status:400});
 const d=parsed.data;
 const date=new Date(d.referenceDate+'T12:00:00Z');
 if(Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==d.referenceDate ||
    d.referenceDate>new Date().toISOString().slice(0,10) ||
    d.baseYear>date.getUTCFullYear())
   return NextResponse.json({error:'Data ou ano-base incompatível'},{status:400});
 const [result]=await queryForMunicipality<{changed:boolean;version:number}>(
  user.municipality_id,UPSERT_CAPAG_SQL,
  [user.municipality_id,d.classification,d.baseYear,d.referenceDate,d.officialUrl,
   d.sourceLabel,user.id],user.id);
 return NextResponse.json({ok:true,changed:result.changed,version:result.version});
}
