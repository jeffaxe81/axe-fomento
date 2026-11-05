export declare function validateDate(value:unknown):boolean;
export declare function todaySaoPaulo(now?:Date):string;
export declare function daysToExpiry(validUntil:string,today:string):number|null;
export declare function expiryStatus(validUntil:string|null,today:string):{
 kind:'unknown'|'expired'|'due7'|'due30'|'due90'|'current';label:string;days:number|null;
};
export declare function expiryWithin(status:ReturnType<typeof expiryStatus>,window:string):boolean;
