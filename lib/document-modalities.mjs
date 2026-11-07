export const DOCUMENT_MODALITIES = Object.freeze([
  ['convenio','Convênio'],
  ['transferencia','Transferência'],
  ['financiamento','Financiamento'],
  ['cooperacao','Cooperação'],
  ['outra','Outra modalidade'],
]);
export const isDocumentModality = (value) => DOCUMENT_MODALITIES.some(([key])=>key===value);
