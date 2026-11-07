import test from 'node:test';
import assert from 'node:assert/strict';
import {extractRequirementCandidates,MAX_CANDIDATES,MAX_SOURCE_CHARS}
 from '../lib/edict-extraction.mjs';

test('AF-030: preserva página, trecho literal e palavras acentuadas sem inventar fonte',()=>{
 const input='PÁGINA 3\n'+
  'O proponente deverá apresentar certidão municipal atualizada.\n'+
  'página 4\n'+
  'É obrigatório comprovar a contrapartida declarada.\n'+
  'Deve entregar\n'+
  'PÁGINA 10\n'+
  'Este é um parágrafo informativo que não impõe qualquer dever.\n';
 const r=extractRequirementCandidates(input);
 assert.ok(r);
 assert.equal(r.length,3);
 assert.deepEqual(r.map(x=>x.sourcePage),[3,4,4]);
 assert.equal(r[0].sourceExcerpt,'O proponente deverá apresentar certidão municipal atualizada.');
 assert.equal(r[1].evidenceState,'excerpt');
 assert.equal(r[2].evidenceState,'missing');
 assert.equal(r[2].sourceExcerpt,null);
 assert.equal(r[2].suggestedRequirement,'Deve entregar');
});
test('AF-030: não inventa página ausente e rejeita origem sem exigências',()=>{
 const input='As instituições deverão apresentar a documentação.\n'+
  'Texto comum descreve apenas o programa e suas características.';
 const candidates=extractRequirementCandidates(input);
 assert.equal(candidates.length,1);
 assert.equal(candidates[0].sourcePage,null);
 assert.deepEqual(extractRequirementCandidates(
  'Informações gerais sobre programa, localização e apresentação da proposta.'),[]);
});
test('AF-030: normaliza CRLF, não duplica trecho e limita a 25 sugestões',()=>{
 const src='PÁGINA 1\r\n'+Array.from({length:30},(_,i)=>
  i===1?'Deverá apresentar certidão 0':'Deverá apresentar certidão '+i).join('\r\n');
 const result=extractRequirementCandidates(src);
 assert.equal(result.length,MAX_CANDIDATES);
 assert.deepEqual(result.map(x=>x.seq),Array.from({length:25},(_,i)=>i+1));
 assert.equal(result[0].sourcePage,1);
 assert.equal(result[0].suggestedRequirement,'Deverá apresentar certidão 0');
});
test('AF-030: falha fechada para texto inválido, excessivo ou sem evidência legível',()=>{
 for(const bad of [null,{},'', 'curto','x'.repeat(MAX_SOURCE_CHARS+1),
  'Documento deverá\x00 apresentar mais alguma informação.',
  '\n'.repeat(1100)]){
  assert.equal(extractRequirementCandidates(bad),null);
 }
 const tooLong='Será obrigatório '+('x'.repeat(1200))+'\n'+
  'Documento deverá apresentar outra evidência original pertinente.';
 const candidates=extractRequirementCandidates(tooLong);
 assert.equal(candidates.length,1);
 assert.match(candidates[0].sourceExcerpt,/Documento deverá/);
});
