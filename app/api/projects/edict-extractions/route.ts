import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {extractRequirementCandidates,MAX_SOURCE_CHARS} from '@/lib/edict-extraction.mjs';
import {CREATE_EDICT_EXTRACTION_SQL} from '@/lib/edict-extraction-sql.mjs';
export const runtime='nodejs';

const schema=z.object({
 projectId:z.string().uuid(),
 documentVersionId:z.string().uuid(),
 sourceText:z.string().min(20).max(MAX_SOURCE_CHARS),
 note:z.string().trim().min(10).max(500),
}).strict();
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);
 if(blocked)return blocked;
 if(process.env.ENABLE_EDICT_ASSISTED_EXTRACTION!=='yes')
  return NextResponse.json({error:'Extração assistida não homologada'},{status:503});
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Não autenticado'},{status:401});
 let data:unknown;
 try{data=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(data);
 if(!parsed.success)return NextResponse.json({error:'Dados da extração inválidos'},{status:400});
 const d=parsed.data;
 const candidates=extractRequirementCandidates(d.sourceText);
 if(!candidates)return NextResponse.json({error:'Formato ou tamanho do texto inválido'},{status:400});
 if(!candidates.length)return NextResponse.json({
  error:'Nenhum possível requisito encontrado; inclua trechos com obrigações explícitas'
 },{status:422});
 const normalized=d.sourceText.normalize('NFC').replace(/\r\n?/g,'\n');
 const hash=createHash('sha256').update(normalized,'utf8').digest('hex');
 const json=candidates.map(c=>({
  seq:c.seq,
  source_page:c.sourcePage,
  source_excerpt:c.sourceExcerpt,
  suggested_requirement:c.suggestedRequirement,
  evidence_state:c.evidenceState,
 }));
 const [row]=await queryForMunicipality<{
  eligible:boolean;batch_id:string|null;inserted:number
 }>(user.municipality_id,CREATE_EDICT_EXTRACTION_SQL,[
  user.municipality_id,d.projectId,d.documentVersionId,hash,
  normalized.length,candidates.length,d.note,user.id,JSON.stringify(json)
 ],user.id);
 if(!row?.eligible)return NextResponse.json({
  error:'Projeto ou versão de documento indisponível ao responsável deste município'
 },{status:404});
 if(!row.batch_id||row.inserted!==candidates.length)
  return NextResponse.json({error:'Não foi possível registrar o lote completo'},{status:409});
 return NextResponse.json({
  batchId:row.batch_id,candidates:row.inserted,
  evidenceMissing:candidates.filter(c=>c.evidenceState==='missing').length,
  method:'heuristic_from_user_text'
 },{status:201,headers:{'cache-control':'no-store'}});
}
