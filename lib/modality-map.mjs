export const MODALITIES=[
 ['convenio','Convênio'],['transferencia','Transferência'],
 ['financiamento','Financiamento'],['cooperacao','Cooperação'],['outra','Outra']
];
export const REVIEW_STATES=[
 ['pendente','Pendente de avaliação'],['atendido','Atendido (declarado)'],
 ['nao_atendido','Não atendido (declarado)'],['nao_aplicavel','Não aplicável (declarado)']
];
export function modalityLabel(value){
 return MODALITIES.find(([v])=>v===value)?.[1]??'Modalidade desconhecida';
}
export function reviewLabel(value){
 return REVIEW_STATES.find(([v])=>v===value)?.[1]??'Pendente de avaliação';
}
export function countReviews(checks){
 const totals={pendente:0,atendido:0,nao_atendido:0,nao_aplicavel:0};
 for(const check of checks){
  const status=check.status;
  if(status in totals)totals[status]++;
  else totals.pendente++;
 }
 return totals;
}
