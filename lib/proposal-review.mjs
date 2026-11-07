// AF-033: human decision is tied to ONE immutable content version.
// No editorial approval is a legal/funding approval or external protocol.
export const PROPOSAL_REVIEW_DECISIONS=[
 ['aprovada','Aprovada somente para revisão editorial interna'],
 ['devolvida','Devolvida ao redator para ajustes']
];
export const PROPOSAL_REVIEW_LABELS=Object.fromEntries(PROPOSAL_REVIEW_DECISIONS);

export function proposalApprovalBlockers(version){
 if(!version||typeof version!=='object'||!version.sections)return ['versao'];
 const entries=Object.values(version.sections);
 if(entries.some(s=>typeof s!=='string'||s.includes('[PREENCHER E VALIDAR'))){
  return ['marcadores_pendentes'];
 }
 return [];
}
