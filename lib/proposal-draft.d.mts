export declare const SECTION_LABELS:ReadonlyArray<readonly [string,string]>;
export declare const SECTION_IDS:ReadonlyArray<string>;
export declare const MISSING_LABELS:Record<string,string>;
export type ProposalSections=Record<'summary'|'justification'|'objectives'|'execution'|'budget'|'requirements',string>;
export declare function validateProposalSections(input:unknown):ProposalSections|null;
export declare function buildProposalDraft(data:any):{
 sections:ProposalSections;missingFields:string[];sourceSnapshot:Record<string,unknown>
}|null;
