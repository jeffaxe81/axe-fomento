import {normalizePortal} from './external-protocol.mjs';
import {validateDate,todaySaoPaulo} from './document-validity.mjs';

import {FINANCIER_TYPES,FINANCIER_MODALITIES,FINANCIER_AREAS,CHECK_LABELS} from './financier-options.mjs';
export {FINANCIER_TYPES,FINANCIER_MODALITIES,FINANCIER_AREAS,CHECK_LABELS} from './financier-options.mjs';

export function distinctControlledTags(value,registry,max){
 return Array.isArray(value)&&value.length>=1&&value.length<=max&&
  value.every(x=>typeof x==='string'&&Object.hasOwn(registry,x))&&
  new Set(value).size===value.length;
}

/** Validates human-declared reference; never fetches or certifies any URL. */
export function validFinancierVersion(input,today=todaySaoPaulo()){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const source=normalizePortal(input.referenceUrl);
 if(!source||typeof input.referenceTitle!=='string'||
  input.referenceTitle.trim().length<5||input.referenceTitle.length>180||
  typeof input.referenceSection!=='string'||input.referenceSection.trim().length<3||
  input.referenceSection.length>120||
  typeof input.evidenceNote!=='string'||input.evidenceNote.trim().length<20||
  input.evidenceNote.length>1000||!Object.hasOwn(CHECK_LABELS,input.checkStatus))
  return null;
 const date=input.checkedOn===''||input.checkedOn==null?null:input.checkedOn;
 if(date!==null&&(!validateDate(date)||date<'2000-01-01'||date>today))return null;
 if(input.checkStatus==='consultada_internamente'&&date===null)return null;
 return {referenceUrl:source.url,referenceTitle:input.referenceTitle.trim(),
  referenceSection:input.referenceSection.trim(),
  checkStatus:input.checkStatus,checkedOn:date,evidenceNote:input.evidenceNote.trim()};
}

export function financierFilters(input={}){
 const first=x=>Array.isArray(x)?x[0]:x;
 const search=typeof first(input.busca)==='string'?
  first(input.busca).replaceAll('\0','').trim().slice(0,100):'';
 const area=Object.hasOwn(FINANCIER_AREAS,first(input.area))?first(input.area):'';
 const modality=Object.hasOwn(FINANCIER_MODALITIES,first(input.modalidade))?
  first(input.modalidade):'';
 const rawPage=first(input.pagina);
 const page=typeof rawPage==='string'&&/^[1-9]\d{0,2}$/.test(rawPage)?
  Math.min(100,Number(rawPage)):1;
 return {search,area,modality,page};
}
export function financierHref(filters,page=1){
 const qs=new URLSearchParams();
 if(filters.search)qs.set('busca',filters.search);
 if(filters.area)qs.set('area',filters.area);
 if(filters.modality)qs.set('modalidade',filters.modality);
 if(page>1)qs.set('pagina',String(page));
 return '/financiadores'+(qs.size?'?'+qs.toString():'');
}
