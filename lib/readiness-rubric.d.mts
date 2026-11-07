export type Criterion={id:string;label:string;weight:number};
export type CriterionScore={id:string;score:number|null;evidence:string|null};
export declare function validateRubric(criteria:unknown):ReadonlyArray<Readonly<Criterion>>;
export declare function scoreReadiness(criteria:unknown,assessments:unknown):{
 score:number;maximumPossibleScore:number;evaluatedWeight:number;complete:boolean;
 breakdown:Array<Criterion&{score:number|null;evidence:string|null;weightedPoints:number|null}>;
};
