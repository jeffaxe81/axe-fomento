export declare const BASELINE_CRITERIA:ReadonlyArray<{id:string;label:string;weight:number}>;
export declare const BLOCKER_RULES:ReadonlyArray<{code:string;label:string}>;
export declare function validateBlockers(input:unknown):Array<{code:string;rule:string;evidence:string}>;
export declare function readinessActions(result:any,blockers:any[]):any[];
export declare function calculateReadiness(rubric:any[],answers:any[],blockers:any[]):any;
