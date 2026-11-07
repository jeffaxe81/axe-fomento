import test from 'node:test';
import assert from 'node:assert/strict';
import {fold,semanticIntent,semanticSelection,semanticHref} from '../lib/semantic-intent.mjs';

test('AF-031: busca por intenção reconhece saúde e escola em português',()=>{
 const s=semanticIntent('Quero melhorar postos de saúde');
 assert.ok(s);
 assert.ok(s.categories.includes('saude'));
 assert.ok(s.terms.some(t=>t.term==='hospital'));
 assert.ok(s.terms.some(t=>t.term==='saúde'));
 assert.ok(s.terms.some(t=>t.term==='saude'));
 assert.ok(s.terms.some(t=>t.term==='postos'&&t.weight===4));
 const e=semanticIntent('Financiar construção de creches e escolas');
 assert.ok(e.categories.includes('educacao'));
 assert.ok(e.terms.some(t=>t.term==='educação'));
 assert.equal(fold('SANEAMENTO ÁGUA'),'saneamento agua');
});
test('AF-031: controla duplicatas, limites e metacaracteres sem SQL dinâmico',()=>{
 const v=semanticIntent('saúde saúde SUS');
 assert.ok(v);
 assert.equal(v.terms.filter(t=>t.term==='saúde').length,1);
 assert.equal(semanticIntent('de e para'),null);
 assert.equal(semanticIntent(''),null);
 assert.equal(semanticIntent('a'.repeat(121)),null);
 assert.equal(semanticIntent('teste\u0000externo'),null);
 assert.equal(semanticIntent('%_?'),null);
 const long=semanticIntent('saúde agricultura escolas cultura inovação esporte saneamento transporte moradia educação');
 assert.ok(long.terms.length<=40);
 assert.ok(long.terms.every(t=>t.weight>=1&&t.weight<=4));
});
test('AF-031: filtro GET e paginação limitados sem perder intenção',()=>{
 const s=semanticSelection({intencao:'Saúde pública',tipo:'programas',pagina:'2'});
 assert.equal(s.mode,'programas');assert.equal(s.page,2);
 assert.equal(semanticHref(s.intent,s.mode,2),'/oportunidades/semantica?intencao=Sa%C3%BAde+p%C3%BAblica&tipo=programas&pagina=2');
 assert.equal(semanticSelection({intencao:'educação',pagina:'999'}).page,100);
 assert.equal(semanticSelection({intencao:'educação',pagina:'1 OR 1=1'}).page,1);
 assert.equal(semanticSelection({intencao:['creche','hospital'],tipo:'invalido'}).mode,'oportunidades');
});
