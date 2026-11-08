export declare const PROPOSAL_REVIEW_DECISIONS:ReadonlyArray<readonly [string,string]>;
export declare const PROPOSAL_REVIEW_LABELS:Record<string,string>;
export declare function proposalApprovalBlockers(version:{
 sections:Record<string,string>
}|null):string[];
