import {validateDate,todaySaoPaulo} from './document-validity.mjs';
import {normalizePortal} from './external-protocol.mjs';

export function validNormativeVersion(input,today=todaySaoPaulo()){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const source=normalizePortal(input.sourceUrl);
 if(!source||!validateDate(input.publishedOn)||!validateDate(input.validFrom)||
  input.publishedOn<'2000-01-01'||input.publishedOn>today||
  input.validFrom<'2000-01-01'||input.validFrom>'2100-12-31')return null;
 const until=input.validUntil===''||input.validUntil==null?null:input.validUntil;
 if(until!==null&&(!validateDate(until)||until<'2000-01-01'||
  until>'2100-12-31'||until<input.validFrom))return null;
 return {sourceUrl:source.url,publishedOn:input.publishedOn,
  validFrom:input.validFrom,validUntil:until};
}
export function normativeVersionLabel(dateFrom,dateUntil,today=todaySaoPaulo()){
 if(!validateDate(dateFrom)||dateUntil!==null&&!validateDate(dateUntil))
  return 'Data informada inválida';
 if(dateFrom>today)return 'Início informado no futuro';
 if(dateUntil!==null&&dateUntil<today)return 'Término informado ultrapassado';
 return 'Período informado — conferir na fonte';
}
