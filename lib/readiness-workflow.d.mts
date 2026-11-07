export type Blocker={id:string;title:string;ruleUrl:string;evidence:string;confirmed:boolean};
export type Action={key:string;title:string;priority:string;reason:string};
export declare function validateBlockers(input:unknown):Blocker[];
export declare function planForGaps(scoring:{breakdown:Array<{id:string;label:string;score:number|null}>},blockers:Blocker[]):Action[];
export declare function simulateReadiness(rubric:unknown,original:Array<{id:string;score:number|null;evidence:string|null}>,changes:unknown):{current:{score:number;breakdown:unknown[]};hypothetical:{score:number;breakdown:unknown[]};delta:number;disclaimer:string};
