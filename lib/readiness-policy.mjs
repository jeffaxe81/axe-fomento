import {scoreReadiness,validateRubric} from './readiness-rubric.mjs';
export const BASELINE_CRITERIA=Object.freeze([
 {id:'diagnostico',label:'Problema, contexto e público beneficiado',weight:25},
 {id:'solucao',label:'Escopo técnico e solução proposta',weight:25},
 {id:'orcamento',label:'Estimativas e sustentação orçamentária',weight:30},
 {id:'execucao',label:'Cronograma e capacidade de execução',weight:20}
]);
export const BLOCKER_RULES=Object.freeze([
 {code:'elegibilidade',label:'Possível incompatibilidade com regra do edital'},
 {code:'documentacao',label:'Documento obrigatório ausente ou inválido (declaração humana)'},
 {code:'orcamento',label:'Fontes de cobertura financeira não demonstradas'},
 {code:'competencia',label:'Competência legal ou institucional não comprovada'}
]);
export function validateBlockers(input){
 if(!Array.isArray(input)||input.length>8)throw Error('Impedimentos inválidos');
 const seen=new Set();
 return input.map(item=>{
  const rule=BLOCKER_RULES.find(r=>r.code===item?.code);
  if(!rule||seen.has(rule.code)||typeof item.evidence!=='string'||
   item.evidence.trim().length<15||item.evidence.length>1000)throw Error('Impedimento sem regra ou evidência');
  seen.add(rule.code);
  return {code:rule.code,rule:rule.label,evidence:item.evidence.trim()};
 });
}
export function readinessActions(result,blockers){
 const items=blockers.map(x=>({
  id:'imp-'+x.code,priority:'critica',reason:x.rule,
  recommendation:'Conferir a regra e resolver o possível impedimento com responsável técnico e evidência.',
  impact:0
 }));
 for(const x of result.breakdown){
  if(x.score===null||x.score<80){
   const impact=Math.round(((100-(x.score??0))*x.weight/100)*100)/100;
   items.push({id:'crit-'+x.id,priority:impact>=15?'alta':'media',
    reason:x.score===null?'Evidência ainda ausente: '+x.label:'Maturidade declarada abaixo de 80: '+x.label,
    recommendation:'Completar evidências, verificar com a equipe e reavaliar '+x.label+'.',
    impact});
  }
 }
 const rank={critica:0,alta:1,media:2};
 return items.sort((a,b)=>rank[a.priority]-rank[b.priority]||b.impact-a.impact||a.id.localeCompare(b.id));
}
export function calculateReadiness(rubric,answers,blockers){
 const criteria=validateRubric(rubric),blockages=validateBlockers(blockers);
 const result=scoreReadiness(criteria,answers);
 return {...result,blockers:blockages,actions:readinessActions(result,blockages),
  warning:'Pontuação indicativa; impedimentos são independentes da nota e exigem validação humana.'};
}
