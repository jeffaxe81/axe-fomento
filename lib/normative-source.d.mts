export declare function validNormativeVersion(input:{
 sourceUrl:string;publishedOn:string;validFrom:string;validUntil:string|null;
},today?:string):{
 sourceUrl:string;publishedOn:string;validFrom:string;validUntil:string|null;
}|null;
export declare function normativeVersionLabel(from:string,until:string|null,today?:string):string;
