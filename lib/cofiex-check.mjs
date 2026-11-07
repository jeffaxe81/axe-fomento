import {validateDate} from './document-validity.mjs';
import {COFIEX_STATES} from './cofiex-labels.mjs';
export {COFIEX_STATES} from './cofiex-labels.mjs';
export function validCofiexCheck(input,today){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 if(!Object.hasOwn(COFIEX_STATES,input.consultationState)||
  !validateDate(input.consultedOn)||input.consultedOn<'2000-01-01'||
  input.consultedOn>today||input.acknowledgedLimits!==true)return null;
 return {stageCode:input.stageCode,expectedRevision:input.expectedRevision,
  consultationState:input.consultationState,consultedOn:input.consultedOn,
  note:input.note.trim(),acknowledgedLimits:true};
}
export function cofiexStatusAge(consultedOn,today){
 if(!consultedOn)return 'Sem conferência interna registrada';
 if(!validateDate(consultedOn)||!validateDate(today))return 'Data inválida';
 const days=Math.floor((Date.parse(today+'T12:00:00Z')-
  Date.parse(consultedOn+'T12:00:00Z'))/86400000);
 return days>=90?'Conferência antiga (90+ dias): verificar novamente a origem':
  'Consulta interna registrada — verificar alterações oficiais';
}
