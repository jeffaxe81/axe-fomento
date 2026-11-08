import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {rejectUntrustedWrite} from '@/lib/security';
import {parseMoneyCents,simulateFinancing} from '@/lib/funding-pipeline.mjs';
export const runtime='nodejs';
const schema=z.object({
 principal:z.string(),annualRateBps:z.number().int().min(0).max(10000),
 months:z.number().int().min(1).max(600),
 graceMonths:z.number().int().min(0).max(120)
}).strict();
export async function POST(request:Request){
 const bad=rejectUntrustedWrite(request);if(bad)return bad;
 const actor=await getSession();if(!actor)return NextResponse.json({error:'Sessão requerida'},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const x=schema.safeParse(body);if(!x.success)return NextResponse.json({error:'Parâmetros inválidos'},{status:400});
 const amount=parseMoneyCents(x.data.principal);
 if(!amount)return NextResponse.json({error:'Valor inválido, use 100000.00'},{status:400});
 try{
  return NextResponse.json({scenario:simulateFinancing({
   principalCents:amount,annualRateBps:x.data.annualRateBps,months:x.data.months,
   graceMonths:x.data.graceMonths}),officialOffer:false},{
   headers:{'cache-control':'no-store'}});
 }catch{return NextResponse.json({error:'Simulação inválida'},{status:400});}
}
