import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {todaySaoPaulo} from '@/lib/document-validity.mjs';
import {validCofiexCheck} from '@/lib/cofiex-check.mjs';
import {CREATE_COFIEX_CHECK_SQL} from '@/lib/cofiex-sql.mjs';
export const runtime='nodejs';

const schema=z.object({
 projectId:z.string().uuid(),
 stageCode:z.string().regex(/^[a-z0-9_]{5,50}$/),
 expectedRevision:z.number().int().min(0).max(999),
 consultationState:z.enum(['em_preparacao','conferido_internamente',
  'aguardando_orgao','revisao_necessaria']),
 consultedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 note:z.string().trim().min(20).max(1000),
 acknowledgedLimits:z.literal(true)
}).strict();

export async function POST(request:Request){
 const untrusted=rejectUntrustedWrite(request);
 if(untrusted)return untrusted;
 if(process.env.ENABLE_COFIEX_CATALOG!=='yes')
  return NextResponse.json({error:'Consulta COFIEX ainda não homologada'},{status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Sessão obrigatória'},{status:401});
 let value:unknown;
 try{value=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(value);
 if(!parsed.success)return NextResponse.json({error:'Registro de consulta inválido'},{status:400});
 const d=parsed.data,checked=validCofiexCheck(d,todaySaoPaulo());
 if(!checked)return NextResponse.json({
  error:'Data, estado ou declaração de limites inválida'
 },{status:422});
 const [record]=await queryForMunicipality<{
  eligible:boolean;recognized:boolean;
  current_revision:number|null;saved_revision:number|null
 }>(actor.municipality_id,CREATE_COFIEX_CHECK_SQL,[
  actor.municipality_id,d.projectId,d.stageCode,d.consultationState,
  d.consultedOn,d.note,actor.id,d.expectedRevision,d.acknowledgedLimits
 ],actor.id);
 if(!record?.eligible)return NextResponse.json({
  error:'Projeto indisponível ou usuário sem permissão de registro'
 },{status:404});
 if(!record.recognized)return NextResponse.json({
  error:'Etapa não encontrada no catálogo oficial de referência'
 },{status:404});
 if(record.saved_revision===null)return NextResponse.json({
  error:'Registro concorrente ou versão desatualizada; recarregue a ficha'
 },{status:409});
 return NextResponse.json({revision:record.saved_revision,
  scope:'consulta_interna_sem_protocolo_oficial'},
  {status:201,headers:{'cache-control':'no-store'}});
}
