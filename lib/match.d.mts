export interface MunicipalityMatch { uf: string; priority_areas: string[]; population: number | null }
export interface OpportunityMatch { eligible_ufs: string[]; areas: string[]; deadline: string | null; min_population: number | null; max_population: number | null }
export interface MatchResult { score: number; band: string; reasons: string[]; eligible: boolean }
export function evaluateMatch(municipality: MunicipalityMatch, opportunity: OpportunityMatch): MatchResult;
