import {createHash} from 'node:crypto';
// Fixed URLs only. The OpenAPI contract is evidence of documented routes, NOT
// evidence of available funds, edital validity or eligibility of a municipality.
export const OFFICIAL_CONTRACTS=Object.freeze({
 parcerias:Object.freeze({
  url:'https://api-publica.transferegov.gestao.gov.br/parcerias/openapi.json',
  docs:'https://api-publica.transferegov.gestao.gov.br/parcerias/docs'
 }),
 discricionarias:Object.freeze({
  url:'https://api-publica.transferegov.gestao.gov.br/discricionarias/openapi.json',
  docs:'https://api-publica.transferegov.gestao.gov.br/discricionarias/docs'
 })
});
const MAX_BYTES=2*1024*1024;
const plain=x=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const allowedPath=p=>typeof p==='string'&&p.startsWith('/')&&p.length<=200&&
 !p.startsWith('//')&&!/[\u0000-\u001f\\?#]/.test(p);
export function inspectOfficialContract(payload,source){
 if(!Object.hasOwn(OFFICIAL_CONTRACTS,source))throw Error('Módulo não autorizado');
 if(!plain(payload)||!/^3\.[0-9]+\.[0-9]+$/.test(String(payload.openapi??''))||
   !plain(payload.paths))throw Error('Contrato OpenAPI incompatível');
 const entries=Object.entries(payload.paths);
 if(!entries.length||entries.length>2000)throw Error('Quantidade de rotas incompatível');
 const invalid=entries.some(([p,v])=>!allowedPath(p)||!plain(v));
 if(invalid)throw Error('Caminho de contrato inválido');
 const gets=entries.filter(([,methods])=>plain(methods.get))
  .map(([path])=>path).sort();
 const candidates=gets.filter(p=>/program|edital|chamament|atos.preparat|propost|instrument/i.test(p));
 return {
  source,schemaUrl:OFFICIAL_CONTRACTS[source].url,
  docsUrl:OFFICIAL_CONTRACTS[source].docs,
  version:payload.openapi,documentedRoutes:gets.length,
  candidateRoutes:candidates.slice(0,30),
  programEndpointDescribed:source==='parcerias'&&gets.some(p=>/^(\/programa|\/programas)\/?$/.test(p)),
  result:gets.length>0?'documented':'incompatible',
  qualification:'Contrato API documentado, sem evidência de edital vigente, capacidade fiscal ou termos de financiamento',
  automaticallyPublishable:false,
  sha256:createHash('sha256').update(JSON.stringify(payload)).digest('hex')
 };
}
export async function fetchOfficialContract(source,fetchImpl=fetch){
 if(!Object.hasOwn(OFFICIAL_CONTRACTS,source))throw Error('Módulo não autorizado');
 const target=OFFICIAL_CONTRACTS[source].url;
 const r=await fetchImpl(target,{method:'GET',redirect:'error',cache:'no-store',
  headers:{accept:'application/json'},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('Resposta HTTP indisponível');
 if(!(r.headers.get('content-type')??'').toLowerCase().includes('json'))
  throw Error('Formato de resposta não é JSON');
 if(!r.body)throw Error('Resposta vazia');
 let size=0;const bytes=[];
 const reader=r.body.getReader();
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>MAX_BYTES)throw Error('Contrato excede limite de 2 MB');
   bytes.push(value);
  }
 }finally{await reader.cancel().catch(()=>{});}
 const buf=new Uint8Array(size);let offset=0;
 for(const part of bytes){buf.set(part,offset);offset+=part.length;}
 let payload;
 try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buf));}
 catch{throw Error('Contrato não contém JSON válido');}
 return inspectOfficialContract(payload,source);
}
