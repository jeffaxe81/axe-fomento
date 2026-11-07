import {scoreReadiness} from './readiness-rubric.mjs';
const code=/^[a-zA-Z0-9_-]{1,50}$/;
function safeUrl(raw){
 try{
  const u=new URL(raw);
  return u.protocol==='https:'&&!u.username&&!u.password&&
   u.hostname.includes('.')&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname);
 }catch{return false;}
}
export function validateBlockers(input){
 if(!Array.isArray(input)||input.length>20)throw Error('Impedimentos inválidos');
 const ids=new Set();
 return input.map(b=>{
  if(!b||typeof b!=='object'||!code.test(b.id)||ids.has(b.id)||
   typeof b.title!=='string'||b.title.trim().length<10||b.title.length>180||
   typeof b.evidence!=='string'||b.evidence.trim().length<20||b.evidence.length>1000||
   typeof b.ruleUrl!=='string'||!safeUrl(b.ruleUrl)||typeof b.confirmed!=='boolean')
   throw Error('Impedimento sem regra, fonte ou evidência válida');
  ids.add(b.id);
  return {id:b.id,title:b.title.trim(),ruleUrl:b.ruleUrl,evidence:b.evidence.trim(),confirmed:b.confirmed};
 });
}
export function planForGaps(scoring,blockers){
 const gaps=scoring.breakdown.filter(x=>x.score===null||x.score<80).map(x=>({
  key:'c-'+x.id,title:'Revisar critério: '+x.label,
  priority:x.score===null||x.score<50?'alta':'media',
  reason:x.score===null?'Sem evidência/nota suficiente.':'Pontuação declarada: '+x.score+' de 100.'
 }));
 const critical=blockers.filter(x=>x.confirmed).map(b=>({
  key:'b-'+b.id,title:'Tratar impedimento: '+b.title,
  priority:'critica',reason:'Regra informada: '+b.ruleUrl+' — '+b.evidence
 }));
 return [...critical,...gaps].slice(0,50);
}
export function simulateReadiness(rubric,original,changes){
 if(!Array.isArray(changes)||changes.length>30)throw Error('Mudanças inválidas');
 const taken=new Set();
 for(const c of changes){
  if(!c||typeof c.id!=='string'||taken.has(c.id)||
   !Number.isInteger(c.score)||c.score<0||c.score>100||
   typeof c.evidence!=='string'||c.evidence.trim().length<5||c.evidence.length>2000)
   throw Error('Simulação inválida');
  taken.add(c.id);
 }
 const current=scoreReadiness(rubric,original);
 const byId=new Map(original.map(x=>[x.id,x]));
 for(const c of changes)byId.set(c.id,{id:c.id,score:c.score,evidence:c.evidence.trim()});
 const hypothetical=scoreReadiness(rubric,[...byId.values()]);
 return {current,hypothetical,delta:Math.round((hypothetical.score-current.score)*100)/100,
  disclaimer:'Cenário hipotético sem alteração da avaliação registrada ou promessa de financiamento'};
}
