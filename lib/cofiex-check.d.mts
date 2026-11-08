export declare const COFIEX_STATES:Record<string,string>;
export type CofiexCheck={stageCode:string;expectedRevision:number;
 consultationState:string;consultedOn:string;note:string;acknowledgedLimits:true};
export declare function validCofiexCheck(input:any,today:string):CofiexCheck|null;
export declare function cofiexStatusAge(consultedOn:string|null,today:string):string;