import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { validateDate } from '@/lib/document-validity.mjs';
import { UPDATE_DOCUMENT_VALIDITY_SQL } from '@/lib/document-validity-sql.mjs';

export const runtime='nodejs';
const schema=z.object({
  projectId:z.string().uuid(),
  itemId:z.string().uuid(),
  validUntil:z.string().nullable(),
  renewalOwnerId:z.string().uuid().nullable(),
  evidenceNote:z.string().trim().max(500),
}).strict().superRefine((input,ctx)=>{
  if(input.validUntil===null){
    if(input.renewalOwnerId!==null || input.evidenceNote!=='')
      ctx.addIssue({code:z.ZodIssueCode.custom,message:'Ao remover validade, limpe responsável e evidência.'});
    return;
  }
  if(!validateDate(input.validUntil) || input.validUntil<'2000-01-01' ||
     input.validUntil>'2100-12-31')
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['validUntil'],
      message:'Data de validade inválida.'});
  if(!input.renewalOwnerId)
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['renewalOwnerId'],
      message:'Informe responsável pela renovação.'});
  if(input.evidenceNote.length<10)
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['evidenceNote'],
      message:'Descreva a origem da validade em ao menos dez caracteres.'});
});
export async function PATCH(request:Request){
 const blocked=rejectUntrustedWrite(request);
 if(blocked)return blocked;
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 let body:unknown;
 try{body=await request.json();}
 catch{return NextResponse.json({error:'JSON inválido'},{status:400});}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:'Validade, responsável ou evidência inválidos'},
  {status:400});
 const d=parsed.data;
 const [result]=await queryForMunicipality<{applicable:boolean;changed:boolean}>(
  user.municipality_id,UPDATE_DOCUMENT_VALIDITY_SQL,
  [user.municipality_id,d.projectId,d.itemId,d.validUntil,d.renewalOwnerId,
   d.evidenceNote,user.id],user.id);
 if(!result.applicable)return NextResponse.json({
  error:'Documento indisponível, de outro município ou responsável inativo'
 },{status:404});
 return NextResponse.json({ok:true,changed:result.changed},{headers:{'cache-control':'no-store'}});
}
