import {PILOT_GATES,isEvidenceUrl} from './pilot-gates.mjs';

const DATE=/^\d{4}-\d{2}-\d{2}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const DAY_MS=86400000;
function dateNumber(v){
 if(typeof v!=='string'||!DATE.test(v))return null;
 const n=Date.parse(v+'T00:00:00Z');
 if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==v)return null;
 return n;
}
/**
 * Conservative documentary preflight. NEVER verifies a real field execution,
 * authority or digital signature; only exposes missing/stale/inconsistent records.
 * Inputs must be newest-first and already scoped to a single municipality.
 */
/**
 * @param {{
 * evidence?:Array<{id:string,gate_id:string,result_claimed:string,created_by:string,
 *  performed_on:string,environment_label:string,evidence_url:string,evidence_sha256:string|null}>,
 * reviews?:Array<{evidence_id:string,decision:string,reviewed_by:string,
 *  acceptance_url:string|null,reviewed_on:string}>,
 * today:string,maxAgeDays?:number
 * }} params
 */
export function auditPilotFieldPacket({
 evidence=[],reviews=[],today,maxAgeDays=30
}){
 const now=dateNumber(today);
 if(now===null||!Number.isInteger(maxAgeDays)||maxAgeDays<1||maxAgeDays>365)
  throw Error('Data ou política de validade inválida');
 const latest=new Map();
 for(const e of evidence){
  if(PILOT_GATES.some(g=>g.id===e.gate_id)&&!latest.has(e.gate_id))latest.set(e.gate_id,e);
 }
 const byEvidence=new Map();
 for(const review of reviews){
  if(!byEvidence.has(review.evidence_id))byEvidence.set(review.evidence_id,review);
 }
 const environmentNames=[...new Set([...latest.values()]
  .map(e=>typeof e.environment_label==='string'?e.environment_label.trim().toLowerCase():'')
  .filter(Boolean))];
 const inconsistentEnvironments=environmentNames.length>1;
 const gateChecks=PILOT_GATES.map(g=>{
  const evidence=latest.get(g.id),review=evidence&&byEvidence.get(evidence.id);
  const issues=[];
  if(!evidence)issues.push('evidencia_nao_registrada');
  else{
   if(evidence.result_claimed!=='pass')issues.push('ensaio_nao_aprovado');
   if(!isEvidenceUrl(evidence.evidence_url))issues.push('url_de_evidencia_invalida');
   if(!DIGEST.test(evidence.evidence_sha256??''))issues.push('checksum_nao_informado');
   const day=dateNumber(evidence.performed_on);
   if(day===null||day>now||now-day>maxAgeDays*DAY_MS)issues.push('ensaio_fora_da_validade');
   if(!evidence.environment_label?.trim())issues.push('ambiente_nao_identificado');
   if(inconsistentEnvironments)issues.push('ambientes_divergentes');
   if(!review||review.decision!=='accepted'||review.reviewed_by===evidence.created_by||
    !isEvidenceUrl(review.acceptance_url))issues.push('revisao_independente_pendente');
   else {
    const reviewed=dateNumber(review.reviewed_on);
    if(reviewed===null||reviewed>now||day===null||reviewed<day||
      now-reviewed>maxAgeDays*DAY_MS)issues.push('data_de_revisao_invalida');
   }
  }
  return {id:g.id,title:g.title,documentaryCheck:issues.length===0?'complete':'incomplete',issues};
 });
 const complete=gateChecks.filter(g=>g.documentaryCheck==='complete').length;
 return {
  checkedAt:today,maximumEvidenceAgeDays:maxAgeDays,
  environmentCount:environmentNames.length,inconsistentEnvironments,
  completeDocumentaryGates:complete,requiredGates:PILOT_GATES.length,
  readyForInstitutionalAudit:complete===PILOT_GATES.length,
  fieldVerifiedGates:0,
  productionDecision:'NO-GO',deploymentAuthorized:false,
  gateChecks,
  note:'Pré-verificação documental, sem comprovação automática do ensaio em campo, assinatura eletrônica ou autorização de produção.'
 };
}
