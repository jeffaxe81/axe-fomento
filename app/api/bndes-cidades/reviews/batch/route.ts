import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {todaySaoPaulo} from '@/lib/document-validity.mjs';
import {bndesReviewInput} from '@/lib/bndes-cities.mjs';
import {BNDES_CITY_BATCH_SQL} from '@/lib/bndes-city-sql.mjs';
export const runtime='nodejs';
const rowSchema=z.object({
 code:z.string().regex(/^[a-z0-9-]{8,120}$/),
 expectedRevision:z.number().int().min(0).max(999),
 sourceState:z.enum(['pagina_conferida','atualizacao_pendente','pagina_indisponivel']),
 availabilityState:z.enum(['nao_apurada','possibilidade_mencionada','nao_localizada']),
 checkedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 note:z.string().trim().min(20).max(1000),
 acknowledgedLimits:z.literal(true)
}).strict();
const schema=z.object({items:z.array(rowSchema).min(1).max(20)}).strict()
 .superRefine((d,ctx)=>{
  if(new Set(d.items.map(i=>i.code)).size!==d.items.length){
   ctx.addIssue({code:z.ZodIssueCode.custom,message:'Referência repetida no lote',
    path:['items']});
  }
 });
type Result={eligible:boolean;requested:number;recognized:number;
 current_versions:boolean;saved:number};
export async function POST(request:Request){
 const denied=rejectUntrustedWrite(request);
 if(denied)return denied;
 if(process.env.ENABLE_BNDES_CITY_CATALOG!=='yes')
  return NextResponse.json({error:'Catálogo aguardando homologação'},{status:503});
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Sessão necessária'},{status:401});
 if(user.role!=='admin')
  return NextResponse.json({error:'Conferência restrita ao administrador municipal'},{status:403});
 let body:unknown;
 try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Lote inválido'},{status:400});
 const today=todaySaoPaulo();
 const mapped=parsed.data.items.map(i=>bndesReviewInput(i,today));
 if(mapped.some(v=>v===null))return NextResponse.json({
  error:'Data futura, situação ou combinação de estados inválida'
 },{status:422});
 const rows=mapped.map(v=>({
  code:v!.code,expected_revision:v!.expectedRevision,
  source_state:v!.sourceState,availability_state:v!.availabilityState,
  checked_on:v!.checkedOn,note:v!.note,
  acknowledged_limits:v!.acknowledgedLimits
 }));
 let result:Result|undefined;
 try{
  [result]=await queryForMunicipality<Result>(user.municipality_id,
   BNDES_CITY_BATCH_SQL,[user.municipality_id,user.id,JSON.stringify(rows)],user.id);
 }catch(error){
  // Concurrent/direct inserts remain all-or-nothing under UNIQUE constraint.
  if(error&&typeof error==='object'&&'code' in error&&error.code==='23505')
   return NextResponse.json({error:'Conferência concorrente: recarregue o catálogo'},
    {status:409});
  throw error;
 }
 if(!result?.eligible)
  return NextResponse.json({error:'Administrador inativo ou sem permissão'},{status:403});
 if(result.recognized!==result.requested)
  return NextResponse.json({error:'Uma ou mais referências não existem no catálogo'},
   {status:404});
 if(!result.current_versions||result.saved!==result.requested)
  return NextResponse.json({
   error:'Lote desatualizado; nenhuma decisão foi gravada. Atualize e tente novamente.'
  },{status:409});
 return NextResponse.json({
  saved:result.saved,scope:'declaracao_municipal_sem_validacao_de_credito'
 },{status:201,headers:{'cache-control':'no-store'}});
}
