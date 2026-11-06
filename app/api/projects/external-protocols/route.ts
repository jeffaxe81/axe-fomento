import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {normalizePortal,validProtocolDate} from '@/lib/external-protocol.mjs';
import {INSERT_EXTERNAL_PROTOCOL_SQL} from '@/lib/external-protocol-sql.mjs';
export const runtime='nodejs';

const schema=z.object({
 projectId:z.string().uuid(),reviewRevision:z.number().int().min(1).max(10000),
 portalName:z.string().trim().min(3).max(120),portalUrl:z.string().trim().min(10).max(500),
 protocolNumber:z.string().trim().min(3).max(160).regex(/^[^\x00-\x1f\x7f]+$/),
 submittedOn:z.string(),proofVersionId:z.string().uuid(),
 note:z.string().trim().min(10).max(500),
}).strict();

export async function POST(request:Request){
 const rejection=rejectUntrustedWrite(request);
 if(rejection)return rejection;
 if(process.env.ENABLE_EXTERNAL_PROTOCOL_RECORDS!=='yes')
  return NextResponse.json({error:'Registro de protocolos desabilitado até homologação'},
   {status:503});
 const actor=await getSession();
 if(!actor)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let body:unknown;
 try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Dados do protocolo inválidos'},{status:400});
 const data=parsed.data;
 const portal=normalizePortal(data.portalUrl);
 if(!portal||!validProtocolDate(data.submittedOn))
  return NextResponse.json({error:'Portal HTTPS público ou data de submissão inválidos'},{status:400});
 const [saved]=await queryForMunicipality<{eligible:boolean;id:string|null}>(
  actor.municipality_id,INSERT_EXTERNAL_PROTOCOL_SQL,
  [actor.municipality_id,data.projectId,actor.id,data.reviewRevision,
   data.portalName,portal.url,portal.host,data.protocolNumber,
   data.proofVersionId,data.submittedOn,data.note],actor.id);
 if(!saved?.eligible)return NextResponse.json({
  error:'Projeto sem autorização interna atual ou comprovante versionado válido neste município'
 },{status:404});
 if(!saved.id)return NextResponse.json({
  error:'Número de protocolo já registrado para este portal neste município'
 },{status:409});
 return NextResponse.json({id:saved.id},{status:201,headers:{'cache-control':'no-store'}});
}
