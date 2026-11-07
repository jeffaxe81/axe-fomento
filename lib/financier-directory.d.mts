export declare const FINANCIER_TYPES:Record<string,string>;
export declare const FINANCIER_MODALITIES:Record<string,string>;
export declare const FINANCIER_AREAS:Record<string,string>;
export declare const CHECK_LABELS:Record<string,string>;
export type FinancierVersion={referenceUrl:string;referenceTitle:string;
 referenceSection:string;checkStatus:string;checkedOn:string|null;evidenceNote:string};
export declare function distinctControlledTags(value:unknown,registry:Record<string,string>,max:number):boolean;
export declare function validFinancierVersion(input:any,today?:string):FinancierVersion|null;
export declare function financierFilters(input?:{busca?:string|string[];
 area?:string|string[];modalidade?:string|string[];pagina?:string|string[]})
 :{search:string;area:string;modality:string;page:number};
export declare function financierHref(filters:{search:string;area:string;modality:string},page?:number):string;
