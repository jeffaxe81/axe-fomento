export const PILOT_GATES=Object.freeze([
 {id:'OP-01',title:'Infraestrutura de destino',required:'URL, build, Compose, logs de inicialização, health'},
 {id:'OP-02',title:'HTTPS e proxy',required:'TLS válido, redirecionamentos, headers e X-Real-IP'},
 {id:'OP-03',title:'Contas e isolamento',required:'Segredos isolados, MFA, testes A/B em ambiente-alvo'},
 {id:'OP-04',title:'Jornada V1',required:'Login, perfil, radar, fonte real, projeto, logout'},
 {id:'OP-05',title:'Backup restaurado',required:'Backup do alvo restaurado em ambiente isolado; RPO e RTO'},
 {id:'OP-06',title:'Operação e observabilidade',required:'Logs, alertas, capacidade, procedimentos de rollback'},
 {id:'OP-07',title:'Resiliência',required:'Ensaios de reinício, indisponibilidade e carga'},
 {id:'OP-08',title:'Privacidade e aceite',required:'LGPD, retenção, responsáveis e assinatura de aceite'}
]);
export function isEvidenceUrl(url){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.search||
   u.hostname==='localhost'||u.hostname.endsWith('.local')||
   u.hostname==='127.0.0.1'||u.hostname==='0.0.0.0'||u.hostname.startsWith('[')||u.href.length>500)return false;
  if(!u.hostname.includes('.')||!u.pathname||u.pathname==='/')return false;
  return true;
 }catch{return false;}
}
export function pilotEvidenceSummary(rows,reviews=[]){
 const latest=new Map();
 for(const row of rows){
  if(!PILOT_GATES.some(g=>g.id===row.gate_id)||latest.has(row.gate_id))continue;
  latest.set(row.gate_id,{id:row.id,createdBy:row.created_by,gateId:row.gate_id,
   resultClaimed:row.result_claimed,environment:row.environment_label,
   date:row.performed_on,evidenceUrl:row.evidence_url});
 }
 const reviewByEvidence=new Map();
 for(const r of reviews){
  if(!reviewByEvidence.has(r.evidence_id))reviewByEvidence.set(r.evidence_id,r);
 }
 const declaredPass=[...latest.values()].filter(x=>x.resultClaimed==='pass').length;
 const independentlyApproved=[...latest.values()].filter(e=>{
  const r=reviewByEvidence.get(e.id);
  return e.resultClaimed==='pass'&&r?.decision==='accepted'&&
   r.reviewed_by!==e.createdBy&&isEvidenceUrl(r.acceptance_url);
 }).length;
 return {
  recordedGateCount:latest.size,declaredPass,required:PILOT_GATES.length,
  independentlyApproved,
  decision:independentlyApproved===PILOT_GATES.length?'READY_FOR_FINAL_AUTHORIZATION':'NO-GO',
  note:'Revisão por segundo administrador é evidência interna, não autorização formal de produção. A liberação final exige aceite institucional documentado.'
 };
}
