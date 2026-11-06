import {parseBRLToCents} from './financial-money.mjs';

// Quantities have maximum precision of 0.001, independent of JS Number.
export function parseQuantityMilli(value){
 if(typeof value!=='string'||!/^(?:0|[1-9][0-9]{0,5})(?:[.,][0-9]{1,3})?$/.test(value))
  return null;
 const [whole,fraction='']=value.replace(',','.').split('.');
 const milli=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0')||'0');
 return milli>=1n&&milli<=999999999n?milli.toString():null;
}
export function budgetLineTotalCents(quantityMilli,unitCostCents){
 try{
  const qty=BigInt(quantityMilli),unit=BigInt(unitCostCents);
  if(qty<1n||qty>999999999n||unit<0n||unit>99999999999999n)return null;
  // Nearest cent, exact integer arithmetic, half-up at 0.5 cent.
  const cents=(qty*unit+500n)/1000n;
  return cents<=99999999999999n?cents.toString():null;
 }catch{return null;}
}
export function formatQuantityMilli(value){
 try{
  const qty=BigInt(value);
  if(qty<0n||qty>999999999n)return 'Quantidade inválida';
  const whole=(qty/1000n).toString();
  const decimal=(qty%1000n).toString().padStart(3,'0').replace(/0+$/,'');
  return decimal?whole+','+decimal:whole;
 }catch{return 'Quantidade inválida';}
}
export function budgetInput(quantity,unitCost){
 const quantityMilli=parseQuantityMilli(quantity);
 const unitCostCents=parseBRLToCents(unitCost);
 if(quantityMilli===null||unitCostCents===null)return null;
 const totalCents=budgetLineTotalCents(quantityMilli,unitCostCents);
 return totalCents===null?null:{quantityMilli,unitCostCents,totalCents};
}
