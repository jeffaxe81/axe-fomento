// Manual status ledger for GO/NO-GO. Statuses are declarations, NOT technical proof.
export const OP_GATES=Object.freeze([
 'OP-01','OP-02','OP-03','OP-04','OP-05','OP-06','OP-07','OP-08'
]);
export function summarizeOperationGates(report){
 const rows=report?.gates;
 if(!rows||typeof rows!=='object'||Array.isArray(rows))throw Error('Portões ausentes');
 const statuses={};
 let approved=0;
 for(const key of OP_GATES){
  const entry=rows[key]??{};
  const decision=['PENDING','APPROVED','BLOCKED'].includes(entry.status)
   ?entry.status:'PENDING';
  const evidence=typeof entry.evidence==='string'&&entry.evidence.trim().length>=8;
  const approver=typeof entry.approver==='string'&&entry.approver.trim().length>=3;
  const date=typeof entry.approved_at==='string'&&
   /^\d{4}-\d{2}-\d{2}$/.test(entry.approved_at)&&
   !Number.isNaN(Date.parse(entry.approved_at+'T00:00:00Z'))&&
   new Date(entry.approved_at+'T00:00:00Z').toISOString().slice(0,10)===entry.approved_at;
  const ready=decision==='APPROVED'&&evidence&&approver&&date;
  statuses[key]=ready?'APPROVED':decision==='BLOCKED'?'BLOCKED':'PENDING';
  if(ready)approved++;
 }
 const context=typeof report?.target==='string'&&report.target.trim().length>=5&&
  typeof report?.commit_sha==='string'&&/^[a-f0-9]{40}$/i.test(report.commit_sha)&&
  typeof report?.accepted_by==='string'&&report.accepted_by.trim().length>=3;
 return {declaredApproved:approved,total:OP_GATES.length,percentage:Math.round(100*approved/OP_GATES.length),
  statuses,contextComplete:!!context,decision:approved===8&&context?'REQUIRES_MANUAL_GO_APPROVAL':'NO-GO'};
}
