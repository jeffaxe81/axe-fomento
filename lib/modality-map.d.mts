export declare const MODALITIES: readonly (readonly [string,string])[];
export declare const REVIEW_STATES: readonly (readonly [string,string])[];
export declare function modalityLabel(value:string):string;
export declare function reviewLabel(value:string):string;
export declare function countReviews(checks:ReadonlyArray<{status:string|null}>):{
 pendente:number;atendido:number;nao_atendido:number;nao_aplicavel:number
};
