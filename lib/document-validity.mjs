export function validateDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function todaySaoPaulo(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const byType=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return byType.year+'-'+byType.month+'-'+byType.day;
}
export function daysToExpiry(validUntil,today){
 if(!validateDate(validUntil)||!validateDate(today))return null;
 const end=Date.parse(validUntil+'T12:00:00Z'),start=Date.parse(today+'T12:00:00Z');
 return Math.round((end-start)/86400000);
}
export function expiryStatus(validUntil,today){
 if(validUntil==null)return {kind:'unknown',label:'Sem validade informada',days:null};
 const days=daysToExpiry(validUntil,today);
 if(days==null)return {kind:'unknown',label:'Data inválida',days:null};
 if(days<0)return {kind:'expired',label:'Vencido',days};
 if(days<=7)return {kind:'due7',label:days===0?'Vence hoje':'Vence em até 7 dias',days};
 if(days<=30)return {kind:'due30',label:'Vence em até 30 dias',days};
 if(days<=90)return {kind:'due90',label:'Vence em até 90 dias',days};
 return {kind:'current',label:'Validade superior a 90 dias',days};
}
export function expiryWithin(status,window){
 if(window==='expired')return status.kind==='expired';
 if(window==='7')return status.days!==null&&status.days<=7;
 if(window==='30')return status.days!==null&&status.days<=30;
 if(window==='90')return status.days!==null&&status.days<=90;
 return status.days!==null;
}
