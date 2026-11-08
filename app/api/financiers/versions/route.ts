import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {validFinancierVersion} from '@/lib/financier-directory.mjs';
import {ADD_FINANCIER_VERSION_SQL} from '@/lib/financier-directory-sql.mjs';
export const runtime='nodejs';
const schema=z.object({
 financierId:z.string().uuid(),
 expectedVersion:z.number().int().min(1).max(999),
 referenceUrl:z.string().trim().min(12).max(500),
 referenceTitle:z.string().trim().min(5).max(180),
 referenceSection:z.string().trim().min(3).max(120),
 checkStatus:z.enum(['referencia_informada','consultada_internamente','revisao_necessaria']),
 checkedOn:z.string().nullable(),
 evidenceNote:z.string().trim().min(20).max(1000)
}).strict();

export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);if(blocked)return blocked;
 if(process.env.ENABLE_FINANCIER_DIRECTORY!=='yes')
  return NextResponse.json({error:'Diretório aguardando homologação'},{status:503});
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Sessão necessária'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Ação restrita a administrador'},{status:403});
 let body:unknown;
 try{body=await request.json();}catch{
  return NextResponse.json({error:'JSON inválido'},{status:400});
 }
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Atualização inválida'},{status:400});
 const x=parsed.data,v=validFinancierVersion(x);
 if(!v)return NextResponse.json({error:'Fonte, data ou situação inválida'},{status:400});
 const [result]=await queryForMunicipality<{
  eligible:boolean;current_version:number|null;id:string|null;version:number|null
 }>(user.municipality_id,ADD_FINANCIER_VERSION_SQL,[
  user.municipality_id,user.id,x.financierId,x.expectedVersion,
  v.referenceUrl,v.referenceTitle,v.referenceSection,
  v.checkStatus,v.checkedOn,v.evidenceNote
 ],user.id);
 if(!result?.eligible)return NextResponse.json({
  error:'Instituição não encontrada neste município'
 },{status:404});
 if(!result.id)return NextResponse.json({
  error:'Versão divergente: atualize o histórico antes de registrar nova conferência'
 },{status:409});
 return NextResponse.json({id:result.id,version:result.version},
  {status:201,headers:{'cache-control':'no-store'}});
}
