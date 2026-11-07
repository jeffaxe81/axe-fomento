import test from 'node:test';
import assert from 'node:assert/strict';
import {FINANCIER_AREAS,FINANCIER_MODALITIES,validFinancierVersion,
 distinctControlledTags,financierFilters,financierHref} from '../lib/financier-directory.mjs';

const v={referenceUrl:'https://www.gov.br/portal/financiamento',
 referenceTitle:'Página institucional de referência',
 referenceSection:'Instituições e programas',
 checkStatus:'consultada_internamente',checkedOn:'2026-01-15',
 evidenceNote:'Equipe conferiu a identificação da instituição na página informada.'};

test('AF-034: referência institucional é declaração verificável, não funding ativo',()=>{
 assert.deepEqual(validFinancierVersion(v,'2026-11-07'),
  {...v,referenceUrl:v.referenceUrl});
 assert.equal(validFinancierVersion({...v,checkedOn:null},'2026-11-07'),null);
 assert.equal(validFinancierVersion({...v,checkedOn:'2027-01-01'},'2026-11-07'),null);
 assert.equal(validFinancierVersion({...v,referenceUrl:'http://www.gov.br'},'2026-11-07'),null);
 assert.equal(validFinancierVersion({...v,referenceUrl:'https://127.0.0.1/interno'},'2026-11-07'),null);
 assert.equal(validFinancierVersion({...v,referenceUrl:'https://example.org/link?token=secret'},'2026-11-07'),null);
 assert.equal(validFinancierVersion({...v,checkStatus:'aprovado'},'2026-11-07'),null);
 assert.ok(validFinancierVersion({...v,checkStatus:'referencia_informada',checkedOn:null},'2026-11-07'));
});
test('AF-034: múltiplas modalidades/áreas apenas com valores controlados, sem duplicatas',()=>{
 assert.equal(distinctControlledTags(['credito','doacao'],FINANCIER_MODALITIES,6),true);
 assert.equal(distinctControlledTags(['credito','credito'],FINANCIER_MODALITIES,6),false);
 assert.equal(distinctControlledTags(['outro'],FINANCIER_MODALITIES,6),false);
 assert.equal(distinctControlledTags(['saude','saneamento'],FINANCIER_AREAS,12),true);
 assert.equal(distinctControlledTags([],FINANCIER_AREAS,12),false);
});
test('AF-034: filtro literal, paginação limitada e navegação preservada',()=>{
 const f=financierFilters({busca:' Financiador 100%_ ',area:'saude',
 modalidade:'credito',pagina:'2'});
 assert.deepEqual(f,{search:'Financiador 100%_',area:'saude',modality:'credito',page:2});
 assert.equal(financierHref(f,2),
 '/financiadores?busca=Financiador+100%25_&area=saude&modalidade=credito&pagina=2');
 assert.equal(financierFilters({pagina:'1000',area:'invalido'}).page,1);
 assert.equal(financierFilters({pagina:'999'}).page,100);
 assert.equal(financierFilters({busca:'a\0b'}).search,'ab');
});
