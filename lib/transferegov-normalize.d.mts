export declare const SOURCE_URL: string;
export type NormalizedProgram = { externalId: string; title: string; provider: string; sourceUrl: string };
export declare function normalizeProgram(row: unknown): NormalizedProgram | null;
export declare function extractPrograms(payload: unknown, maximum?: number): NormalizedProgram[];
