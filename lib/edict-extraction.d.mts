export interface EdictCandidate {
 seq:number;
 sourcePage:number|null;
 sourceExcerpt:string|null;
 suggestedRequirement:string;
 evidenceState:'excerpt'|'missing';
}
export declare const MAX_SOURCE_CHARS:number;
export declare const MAX_CANDIDATES:number;
export declare function extractRequirementCandidates(sourceText:string):EdictCandidate[]|null;
