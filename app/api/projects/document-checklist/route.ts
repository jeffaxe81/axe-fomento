import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { START_DOCUMENT_CHECKLIST_SQL } from '@/lib/document-checklist-sql.mjs';

export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),
 modality:z.enum(['convenio','transferencia','financiamento','cooperacao','outra']),
}).strict();

export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);
 if(blocked)return blocked;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Permissão insuficiente'},{status:403});
 let input:unknown;
 try{input=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const p=schema.safeParse(input);
 if(!p.success)return NextResponse.json({error:'Dados de checklist inválidos'},{status:400});
 const [result]=await queryForMunicipality<{
  project_exists:boolean;templates_available:boolean;created:boolean;
  modality:string|null;seeded_count:number;
 }>(user.municipality_id,START_DOCUMENT_CHECKLIST_SQL,
  [user.municipality_id,p.data.projectId,p.data.modality,user.id],user.id);
 if(!result.project_exists)return NextResponse.json({error:'Projeto não encontrado'},{status:404});
 if(result.modality && result.modality!==p.data.modality)
  return NextResponse.json({error:'Checklist existente de outra modalidade; alterá-lo exige revisão do projeto'},{status:409});
 if(!result.templates_available && !result.modality)
  return NextResponse.json({error:'Cadastre ao menos um documento-modelo para a modalidade'},{status:409});
 return NextResponse.json({created:result.created,modality:result.modality,itemsAdded:result.seeded_count},
  {status:result.created?201:200});
}
