import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {queryForMunicipality} from '@/lib/db';
import {rejectUntrustedWrite} from '@/lib/security';
import {FINANCIER_TYPES,FINANCIER_AREAS,FINANCIER_MODALITIES,
 distinctControlledTags,validFinancierVersion} from '@/lib/financier-directory.mjs';
import {CREATE_FINANCIER_SQL} from '@/lib/financier-directory-sql.mjs';
export const runtime='nodejs';

const schema=z.object({
 referenceCode:z.string().trim().min(3).max(60)
  .regex(/^[A-Z0-9][A-Z0-9 ._/-]{2,59}$/),
 name:z.string().trim().min(5).max(180),
 institutionType:z.string(),
 financingModalities:z.array(z.string()).min(1).max(6),
 thematicAreas:z.array(z.string()).min(1).max(12),
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
 if(!parsed.success)return NextResponse.json({error:'Dados do financiador inválidos'},{status:400});
 const x=parsed.data,v=validFinancierVersion(x);
 if(!Object.hasOwn(FINANCIER_TYPES,x.institutionType)||
  !distinctControlledTags(x.financingModalities,FINANCIER_MODALITIES,6)||
  !distinctControlledTags(x.thematicAreas,FINANCIER_AREAS,12)||!v)
  return NextResponse.json({error:'Modalidade, área ou referência pública inválida'},{status:400});
 const [result]=await queryForMunicipality<{
  eligible:boolean;id:string|null;created:boolean
 }>(user.municipality_id,CREATE_FINANCIER_SQL,[
  user.municipality_id,user.id,x.referenceCode,x.name,x.institutionType,
  x.financingModalities,x.thematicAreas,
  v.referenceUrl,v.referenceTitle,v.referenceSection,
  v.checkStatus,v.checkedOn,v.evidenceNote
 ],user.id);
 if(!result?.eligible)return NextResponse.json({error:'Ação não autorizada'},{status:403});
 if(!result.created)return NextResponse.json({
  error:'Código de referência já cadastrado neste município'
 },{status:409});
 return NextResponse.json({id:result.id,version:1,scope:'municipal_reference_only'},
  {status:201,headers:{'cache-control':'no-store'}});
}
