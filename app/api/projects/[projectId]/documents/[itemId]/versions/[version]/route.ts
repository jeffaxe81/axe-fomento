import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { decryptAttachment } from '@/lib/private-attachments.mjs';

export const runtime='nodejs';
type Stored={
 file_name:string;media_type:string;content_length:number;sha256:string;
 ciphertext:Buffer;nonce:Buffer;auth_tag:Buffer;
};
export async function GET(_request:Request,{params}:{
 params:Promise<{projectId:string;itemId:string;version:string}>;
}){
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 if(process.env.ENABLE_DOCUMENT_UPLOADS!=='yes')
  return NextResponse.json({error:'Anexos temporariamente indisponíveis'},{status:503});
 const {projectId,itemId,version}=await params;
 if(!z.string().uuid().safeParse(projectId).success||
    !z.string().uuid().safeParse(itemId).success||
    !/^(?:[1-9]|1[0-9]|20)$/.test(version))
  return NextResponse.json({error:'Versão inválida'},{status:400});
 const [stored]=await queryForMunicipality<Stored>(user.municipality_id,
  'SELECT file_name,media_type,content_length,sha256,ciphertext,nonce,auth_tag '+
  'FROM project_document_versions WHERE municipality_id=$1::uuid AND project_id=$2::uuid '+
  'AND item_id=$3::uuid AND version=$4::integer',
  [user.municipality_id,projectId,itemId,Number(version)],user.id);
 if(!stored)return NextResponse.json({error:'Anexo não encontrado'},{status:404});
 try{
  const bytes=decryptAttachment(stored,user.municipality_id+':'+projectId+':'+itemId);
  const filename=encodeURIComponent(stored.file_name);
  return new NextResponse(new Uint8Array(bytes),{status:200,headers:{
   'content-type':stored.media_type,'content-length':String(bytes.length),
   'content-disposition':"attachment; filename=\"documento\"; filename*=UTF-8''"+filename,
   'cache-control':'no-store, private','x-content-type-options':'nosniff',
   'content-security-policy':"default-src 'none'; sandbox",
  }});
 }catch{return NextResponse.json({error:'Não foi possível verificar o anexo'},{status:503});}
}
