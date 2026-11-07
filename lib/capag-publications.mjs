// Official municipal CAPAG dataset metadata via CKAN. Never infer an individual's CAPAG.
// Source: https://www.tesourotransparente.gov.br/ckan/dataset/capag-municipios
export const DATASET_URL='https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=capag-municipios';
const MAX_BYTES=512*1024;
function validDownloadUrl(value){
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&
   (u.hostname==='www.tesourotransparente.gov.br'||u.hostname==='tesourotransparente.gov.br')&&
   u.pathname.startsWith('/ckan/dataset/')&&u.pathname.includes('/download/')&&
   !u.username&&!u.password&&!u.port&&!u.hash;
 }catch{return false;}
}
export function normalizeCapagResources(payload){
 if(payload?.success!==true||!Array.isArray(payload?.result?.resources))
  throw Error('Metadados CKAN ausentes ou incompatíveis');
 const arr=payload.result.resources;
 if(arr.length>150)throw Error('Muitos arquivos no catálogo CAPAG');
 const normalized=arr.flatMap(item=>{
  if(!item||typeof item.name!=='string'||typeof item.url!=='string'||
   item.format?.toUpperCase()!=='XLSX'||!validDownloadUrl(item.url)||
   item.name.length>180||!/capag/i.test(item.name))return [];
  const yearMatches=[...item.name.matchAll(/20[12]\d/g)].map(m=>Number(m[0]));
  const year=yearMatches.find(y=>y>=2018&&y<=2100)??null;
  const date=/(\d{2})\/(\d{2})\/(20\d{2})/.exec(item.name);
  const observedDate=date?`${date[3]}-${date[2]}-${date[1]}`:null;
  const publicationDate=observedDate&&Number.isFinite(Date.parse(observedDate))
   &&new Date(observedDate+'T00:00:00Z').toISOString().slice(0,10)===observedDate
   ?observedDate:null;
  return [{resourceId:String(item.id??''),name:item.name.trim(),url:item.url,
   publishedForYear:year,publicationDate,
   originalSizeBytes:Number(item.size)||null,format:'XLSX',
   observation:'Fonte governamental, não é nota individual nem autorização do Tesouro'}];
 });
 return normalized.sort((a,b)=>(b.publicationDate??String(b.publishedForYear??''))
  .localeCompare(a.publicationDate??String(a.publishedForYear??'')));
}
export async function fetchCapagCatalog(fetchImpl=fetch){
 const response=await fetchImpl(DATASET_URL,{method:'GET',
  redirect:'error',cache:'no-store',headers:{accept:'application/json'},
  signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('Tesouro respondeu HTTP '+response.status);
 if(!(response.headers.get('content-type')??'').toLowerCase().includes('json'))
  throw Error('Tesouro não retornou JSON');
 if(!response.body)throw Error('Resposta sem conteúdo');
 const reader=response.body.getReader();
 const chunks=[];let length=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   length+=value.byteLength;if(length>MAX_BYTES)throw Error('Metadados excedem limite');
   chunks.push(value);
  }
 }finally{await reader.cancel().catch(()=>{});}
 let parsed;
 try{
  const merged=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.length;}
  parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(merged));
 }catch{throw Error('JSON dos metadados inválido');}
 return normalizeCapagResources(parsed);
}
