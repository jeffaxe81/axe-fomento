import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { UPDATE_DOCUMENT_ITEM_SQL } from '@/lib/document-checklist-sql.mjs';

export const runtime='nodejs';
const schema=z.object({
 projectId:z.string().uuid(),
 itemId:z.string().uuid(),
 status:z.enum(['pendente','apresentado','dispensado']),
 evidenceNote:z.string().trim().max(1000),
}).strict().superRefine((value,ctx)=>{
 if(value.status!=='pendente'&&value.evidenceNote.length<10)
  ctx.addIssue({code:z.ZodIssueCode.custom,path:['evidenceNote'],
   message:'Informe justificativa ou referência de comprovação.'});
});

export async function PATCH(request:Request){
 const blocked=rejectUntrustedWrite(request);
 if(blocked)return blocked;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let input:unknown;
 try{input=await request.json();}catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const p=schema.safeParse(input);
 if(!p.success)return NextResponse.json({error:'Estado ou comprovação inválidos'},{status:400});
 const d=p.data;
 const [result]=await queryForMunicipality<{applicable:boolean;changed:boolean}>(
  user.municipality_id,UPDATE_DOCUMENT_ITEM_SQL,
  [user.municipality_id,d.projectId,d.itemId,d.status,d.evidenceNote,user.id],user.id);
 if(!result.applicable)return NextResponse.json({error:'Documento ou projeto não encontrado'},{status:404});
 return NextResponse.json({ok:true,changed:result.changed});
}
