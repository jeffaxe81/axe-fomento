import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { queryForMunicipality } from '@/lib/db';
import { rejectUntrustedWrite } from '@/lib/security';
import { INSERT_DOCUMENT_VERSION_SQL } from '@/lib/document-version-sql.mjs';
import {detectAllowedMedia,encryptAttachment,MAX_FILE_BYTES,MAX_MULTIPART_BYTES,safeFileName}
 from '@/lib/private-attachments.mjs';

export const runtime='nodejs';
const uuid=z.string().uuid();
async function readBounded(request:Request):Promise<Uint8Array|null>{
 if(!request.body)return null;
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];
 let length=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>MAX_MULTIPART_BYTES){await reader.cancel();return null;}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const result=new Uint8Array(length);
 let position=0;for(const chunk of chunks){result.set(chunk,position);position+=chunk.length;}
 return result;
}
export async function POST(request:Request){
 const blocked=rejectUntrustedWrite(request);
 if(blocked)return blocked;
 if(process.env.ENABLE_DOCUMENT_UPLOADS!=='yes')
  return NextResponse.json({error:'Anexos indisponíveis até homologação de segurança'},{status:503});
 const user=await getSession();
 if(!user)return NextResponse.json({error:'Acesso não autorizado'},{status:401});
 const contentType=request.headers.get('content-type')||'';
 if(!contentType.startsWith('multipart/form-data;'))
  return NextResponse.json({error:'Envie formulário multipart'},{status:415});
 const declared=Number(request.headers.get('content-length')||'0');
 if(declared>MAX_MULTIPART_BYTES)
  return NextResponse.json({error:'Arquivo excede o tamanho permitido'},{status:413});
 let form:FormData;
 try{
  const bytes=await readBounded(request);
  if(!bytes)return NextResponse.json({error:'Formulário excede o tamanho permitido'},{status:413});
  form=await new Request(request.url,{method:'POST',headers:{'content-type':contentType},
   body:new Blob([bytes.buffer as ArrayBuffer])}).formData();
 }catch{return NextResponse.json({error:'Formulário multipart inválido'},{status:400});}
 const projectId=form.get('projectId'),itemId=form.get('itemId'),note=form.get('note'),file=form.get('file');
 if(typeof projectId!=='string'||!uuid.safeParse(projectId).success||
    typeof itemId!=='string'||!uuid.safeParse(itemId).success||
    typeof note!=='string'||note.trim().length<10||note.trim().length>500||
    !(file instanceof File))
  return NextResponse.json({error:'Dados do anexo inválidos'},{status:400});
 if(file.size<1||file.size>MAX_FILE_BYTES)
  return NextResponse.json({error:'Arquivo fora do limite de 2 MiB'},{status:413});
 const filename=safeFileName(file.name);
 if(!filename)return NextResponse.json({error:'Nome do arquivo inválido'},{status:400});
 const data=new Uint8Array(await file.arrayBuffer());
 const detected=detectAllowedMedia(data);
 if(!detected||detected!==file.type)
  return NextResponse.json({error:'Somente PDF, PNG ou JPEG com assinatura compatível'},{status:415});
 let encrypted:ReturnType<typeof encryptAttachment>;
 try{encrypted=encryptAttachment(data,user.municipality_id+':'+projectId+':'+itemId);}
 catch{return NextResponse.json({error:'Armazenamento seguro não configurado'},{status:503});}
 const [saved]=await queryForMunicipality<{id:string;version:number}>(
  user.municipality_id,INSERT_DOCUMENT_VERSION_SQL,
  [user.municipality_id,projectId,itemId,filename,detected,data.length,
   encrypted.sha256,encrypted.ciphertext,encrypted.nonce,user.id,encrypted.authTag,note.trim()],
  user.id,
 );
 if(!saved)return NextResponse.json({error:'Documento indisponível ou limite de 20 versões atingido'},
   {status:409});
 return NextResponse.json({id:saved.id,version:saved.version},{status:201,
  headers:{'cache-control':'no-store'}});
}
