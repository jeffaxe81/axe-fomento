export declare function parseQuantityMilli(value:unknown):string|null;
export declare function budgetLineTotalCents(quantityMilli:string|number|bigint,unitCostCents:string|number|bigint):string|null;
export declare function formatQuantityMilli(value:string|number|bigint):string;
export declare function budgetInput(quantity:unknown,unitCost:unknown):{
 quantityMilli:string;unitCostCents:string;totalCents:string
}|null;
