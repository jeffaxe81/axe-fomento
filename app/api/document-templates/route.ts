import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({
 modality:z.enum(['convenio','transferencia','financiamento','cooperacao','outra']),
 title:z.string().trim().min(5).max(180),
 guidance:z.string().trim().max(600),
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
 if(!p.success)return NextResponse.json({error:'Dados de modelo inválidos'},{status:400});
 const [row]=await queryForMunicipality<{id:string}>(user.municipality_id,
  'INSERT INTO municipal_document_templates(municipality_id,modality,title,guidance,created_by) '+
  'VALUES($1,$2,$3,$4,$5) ON CONFLICT(municipality_id,modality,title) DO NOTHING RETURNING id',
  [user.municipality_id,p.data.modality,p.data.title,p.data.guidance,user.id],user.id);
 if(!row)return NextResponse.json({error:'Já existe documento com esse título e modalidade'},{status:409});
 return NextResponse.json({id:row.id},{status:201});
}
