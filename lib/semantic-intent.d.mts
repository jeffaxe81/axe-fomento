export type SemanticTerm={term:string;weight:number};
export type SemanticIntent={input:string;terms:SemanticTerm[];categories:string[];mode:string};
export declare function fold(value:string):string;
export declare function semanticIntent(raw:unknown):SemanticIntent|null;
export declare function semanticSelection(params?:{
 intencao?:string|string[];tipo?:string|string[];pagina?:string|string[];
}):{intent:SemanticIntent|null;mode:'programas'|'oportunidades';page:number};
export declare function semanticHref(intent:SemanticIntent,mode:'programas'|'oportunidades',page?:number):string;
