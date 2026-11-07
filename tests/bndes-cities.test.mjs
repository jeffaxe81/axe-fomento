import test from 'node:test';
import assert from 'node:assert/strict';
import {BNDES_AREAS,bndesReviewInput,bndesFilters,bndesHref,
 bndesReferenceAge} from '../lib/bndes-cities.mjs';

const valid={code:'urbanizacao-integrada',expectedRevision:0,
 sourceState:'pagina_conferida',availabilityState:'nao_apurada',
 checkedOn:'2026-11-07',note:'Conferência editorial realizada na página institucional.',
 acknowledgedLimits:true};
test('AF-035: fonte oficial identificada não implica oferta de crédito',()=>{
 assert.deepEqual(bndesReviewInput(valid,'2026-11-07'),valid);
 assert.equal(bndesReviewInput({...valid,checkedOn:'2026-11-08'},'2026-11-07'),null);
 assert.equal(bndesReviewInput({...valid,checkedOn:'2026-02-30'},'2026-11-07'),null);
 assert.equal(bndesReviewInput({...valid,sourceState:'inventado'},'2026-11-07'),null);
 assert.equal(bndesReviewInput({...valid,acknowledgedLimits:false},'2026-11-07'),null);
 assert.equal(bndesReviewInput({...valid,sourceState:'pagina_indisponivel',
 availabilityState:'possibilidade_mencionada'},'2026-11-07'),null);
});
test('AF-035: busca literal, filtros e paginação preservados',()=>{
 const f=bndesFilters({busca:'  Saúde 100%_ ',area:'saude',fonte:'pagina_conferida',
 disponibilidade:'nao_apurada',conferida:'sim',pagina:'3'});
 assert.deepEqual(f,{search:'Saúde 100%_',area:'saude',sourceState:'pagina_conferida',
 availability:'nao_apurada',reviewed:'sim',page:3});
 assert.equal(bndesHref(f,3),
 '/bndes-cidades?busca=Sa%C3%BAde+100%25_&area=saude&fonte=pagina_conferida&disponibilidade=nao_apurada&conferida=sim&pagina=3');
 assert.equal(bndesFilters({pagina:'1000'}).page,1);
 assert.equal(bndesFilters({pagina:'999'}).page,100);
 assert.equal(bndesFilters({area:'fraude'}).area,'');
 assert.equal(Object.keys(BNDES_AREAS).length,12);
});
test('AF-035: recomendação de revisão sem afirmar indisponibilidade',()=>{
 assert.equal(bndesReferenceAge(null,'2026-11-07'),'Sem conferência municipal');
 assert.match(bndesReferenceAge('2026-01-01','2026-11-07'),/90/);
 assert.match(bndesReferenceAge('2026-11-07','2026-11-07'),/registrada/);
});
