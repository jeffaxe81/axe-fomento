import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProposalDraft,validateProposalSections,SECTION_IDS} from '../lib/proposal-draft.mjs';

const data={project:{id:'p',title:'Creche Municipal Nova',status:'preparacao'},
 municipality:{name:'Cidade Demonstrativa',uf:'SC'},
 opportunity:null,stages:[],requirements:[],edictEvidence:[],
 budgetItems:0,budgetTotalCents:'0'};
test('AF-032: gera 6 seções e identifica informação municipal não declarada',()=>{
 const d=buildProposalDraft(data);
 assert.ok(d);
 assert.deepEqual(Object.keys(d.sections),SECTION_IDS);
 assert.equal(d.missingFields.length,7);
 assert.ok(d.missingFields.includes('budget'));
 assert.match(d.sections.justification,/PREENCHER E VALIDAR/);
 assert.match(d.sections.budget,/R\$ 0,00/);
 assert.match(d.sections.summary,/Creche Municipal Nova/);
 assert.equal(d.sourceSnapshot.opportunity,null);
});
test('AF-032: inclui etapas, valores exatos, regras e sugestões revisadas sem atestar legalidade',()=>{
 const input={...data,opportunity:{id:'o',title:'Programa Social',provider:'Órgão de Teste'},
  budgetItems:1,budgetTotalCents:'123456789',
  stages:[{number:1,title:'Execução etapa 1',startsOn:'2027-01-01',
   endsOn:'2027-06-01',assumptions:'Premissas informadas em testes.'}],
  requirements:[{requirement:'Comprovar documentação do convênio',status:'pendente',
   sourceVersion:'1',sourceSection:'item 1.1'}],
  edictEvidence:[{requirement:'Apresentar certidão municipal',page:7,
   excerpt:'Deverá apresentar certidão atualizada.'}]};
 const draft=buildProposalDraft(input);
 assert.ok(draft);
 assert.ok(!draft.missingFields.includes('budget'));
 assert.ok(!draft.missingFields.includes('edict'));
 assert.ok(draft.missingFields.includes('targets'));
 assert.match(draft.sections.budget,/R\$ 1.234.567,89/);
 assert.match(draft.sections.execution,/Etapa 1/);
 assert.match(draft.sections.requirements,/Página declarada: 7/);
 assert.match(draft.sections.requirements,/aprovação APENAS interna/);
});
test('AF-032: somente aceita 6 seções textuais de tamanho controlado',()=>{
 const generated=buildProposalDraft(data).sections;
 assert.deepEqual(validateProposalSections(generated),generated);
 assert.equal(validateProposalSections({...generated,summary:'x'}),null);
 assert.equal(validateProposalSections({...generated,extra:'invasão'}),null);
 assert.equal(validateProposalSections({...generated,summary:'x'.repeat(4001)}),null);
 assert.equal(validateProposalSections({...generated,summary:'Injeção\u0000 indevida'}),null);
 assert.equal(buildProposalDraft({...data,budgetTotalCents:'not-a-number'}),null);
});
