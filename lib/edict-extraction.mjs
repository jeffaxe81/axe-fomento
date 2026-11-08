// AF-030: explainable, heuristic suggestions from operator-supplied text.
// No OCR, model inference or verification that the text matches the PDF.
// Preserve source phrases exactly; never synthesize requirements or page numbers.
export const MAX_SOURCE_CHARS=16000;
export const MAX_CANDIDATES=25;
const marker=/^[=\-\s]*p(?:á|a)gina\s+([1-9]\d{0,3})[=\-\s]*$/iu;
// Unicode-aware token edges so accents in "deverá" and "obrigatório" work.
const trigger=/(?<![\p{L}\p{N}])(?:dever[aá]|dever[aã]o|deve|devem|obrigat[oó]ri[ao]s?|exig[eê]ncias?|exigido|exigida|exige|apresentar|comprovar|comprova[cç][aã]o|habilita[cç][aã]o|necess[aá]ri[ao]s?|documentos?)(?![\p{L}\p{N}])/iu;

export function extractRequirementCandidates(sourceText){
 if(typeof sourceText!=='string'||sourceText.length<20||
  sourceText.length>MAX_SOURCE_CHARS||
  /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(sourceText))return null;
 const normalized=sourceText.normalize('NFC').replace(/\r\n?/g,'\n');
 if(normalized.length<20)return null;
 const lines=normalized.split('\n');
 if(lines.length>1000)return null;
 const suggestions=[];
 const seen=new Set();
 let page=null;
 for(const raw of lines){
  const line=raw.trim().replace(/[ \t]+/gu,' ');
  const pageMarker=marker.exec(line);
  if(pageMarker){page=Number(pageMarker[1]);continue;}
  if(line.length<10||line.length>1200||!trigger.test(line))continue;
  const unique=line.toLocaleLowerCase('pt-BR');
  if(seen.has(unique))continue;
  seen.add(unique);
  // A short phrase alone does not constitute sufficient textual evidence.
  const excerpt=line.length>=15?line:null;
  suggestions.push({
   seq:suggestions.length+1,
   sourcePage:page,
   sourceExcerpt:excerpt,
   suggestedRequirement:line.slice(0,500),
   evidenceState:excerpt?'excerpt':'missing'
  });
  if(suggestions.length>=MAX_CANDIDATES)break;
 }
 return suggestions;
}
