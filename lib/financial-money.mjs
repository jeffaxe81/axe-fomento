// Decimal currency is parsed exactly; never round through IEEE-754 floating point.
// Accept a single decimal separator (comma or dot) and up to two cent digits.
// Thousands separators and ambiguous formats are intentionally rejected.
export function parseBRLToCents(value){
 if(typeof value!=='string'||!/^[0-9]{1,12}(?:[.,][0-9]{1,2})?$/.test(value))return null;
 const normalized=value.replace(',','.');
 const [whole,dec='']=normalized.split('.');
 const result=BigInt(whole)*100n+BigInt(dec.padEnd(2,'0')||'0');
 return result<=99999999999999n?result.toString():null;
}
export function formatBRLCents(value){
 try{
  if(!/^[0-9]+$/.test(String(value)))return 'Valor inválido';
  const n=BigInt(value);
  return 'R$ '+(n/100n).toLocaleString('pt-BR')+','+(n%100n).toString().padStart(2,'0');
 }catch{return 'Valor inválido';}
}
export function moneyDifferenceCents(planned,realized){
 return (BigInt(realized)-BigInt(planned)).toString();
}
