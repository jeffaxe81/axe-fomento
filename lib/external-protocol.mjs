import {isIP} from 'node:net';
import {validateDate,todaySaoPaulo} from './document-validity.mjs';

export function normalizePortal(value){
 if(typeof value!=='string'||value.length>500)return null;
 try{
  const url=new URL(value.trim());
  if(url.protocol!=='https:'||url.username||url.password||url.port||
   url.hash||url.search)return null;
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(!host.includes('.')||host.length>253||host.startsWith('[')||isIP(host))return null;
  if(!host.split('.').every(label=>label.length>0&&label.length<=63&&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))return null;
  const banned=['localhost','local','internal','invalid','test','example','onion','arpa'];
  if(banned.includes(host.split('.').at(-1))||host.includes('localhost'))return null;
  return {url:url.origin+url.pathname,host};
 }catch{return null;}
}
export function validProtocolDate(date,today=todaySaoPaulo()){
 return validateDate(date)&&date>='2000-01-01'&&date<='2100-12-31'&&date<=today;
}
