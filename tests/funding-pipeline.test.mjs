import test from 'node:test';
import assert from 'node:assert/strict';
import {validOfficialUrl,parseMoneyCents,validDate,classifyObservation,compareOffers,
 simulateFinancing,initialEligibility,checkDossier,handoffFor,alertsFor,operationalOutcomes,
 EVENT_TYPES,MODALITIES,fingerprint} from '../lib/funding-pipeline.mjs';
const observed={id:'1',title:'Obra municipal',source:'bndes',source_url:'https://cidades.bndes.gov.br/',
 modality:'credito',observation_kind:'oportunidade_conferida',reference_status:'conferida_por_operador',
 checked_on:'2026-11-07',opens_on:'2026-11-01',closes_on:'2026-11-20',terms:{}};
test('AF-051..054 somente origens oficiais HTTPS e observações recentes podem parecer abertas',()=>{
 assert.equal(validOfficialUrl('https://api-publica.transferegov.gestao.gov.br/parcerias/programa','transferegov'),true);
 for(const url of ['http://api-publica.transferegov.gestao.gov.br','https://evil.gov.br.attacker.org',
  'https://user:pass@cidades.bndes.gov.br','https://localhost']){
  assert.equal(validOfficialUrl(url,'bndes'),false,url);
 }
 assert.equal(classifyObservation(observed,'2026-11-07'),'potencialmente_aberta_verificar_fonte');
 assert.equal(classifyObservation({...observed,checked_on:'2026-09-01'},'2026-11-07'),'verificacao_desatualizada');
 assert.equal(classifyObservation({...observed,observation_kind:'programa_observado'},'2026-11-07'),'referencia_sem_oferta_confirmada');
 assert.equal(compareOffers([observed], '2026-11-07')[0].status,'potencialmente_aberta_verificar_fonte');
});
test('AF-055 notificações apenas para oportunidade conferida sem inventar abertura',()=>{
 assert.equal(alertsFor([observed],30,'2026-11-07').length,1);
 assert.equal(alertsFor([{...observed,checked_on:'2026-08-01'}],30,'2026-11-07').length,0);
});
test('AF-056 CAPAG não fornece elegibilidade automática',()=>{
 const x=initialEligibility(observed,{population:20000,capag:'A'});
 assert.equal(x.decision,'analise_humana_obrigatoria');
 assert.ok(x.signals.some(s=>s.code==='capag'&&s.state==='revisao_humana'));
});
test('AF-057 comparação conserva URL de origem e dados ausentes',()=>{
 assert.equal(compareOffers([observed,{...observed,id:'2',terms:{annualRate:null}}],'2026-11-07').length,2);
});
test('AF-058 cenários e moeda exata',()=>{
 assert.equal(parseMoneyCents('1000.25'),'100025');
 assert.equal(parseMoneyCents('1e4'),null);
 const r=simulateFinancing({principalCents:'1000000',annualRateBps:0,months:10});
 assert.equal(r.installmentCents,'100000');
 assert.throws(()=>simulateFinancing({principalCents:'100000',annualRateBps:10001,months:10}));
});
test('AF-059 documentação precisa de versão',()=>{
 assert.equal(checkDossier([{title:'Licença',status:'apresentado',versionId:null}]).ready,false);
 assert.equal(checkDossier([{title:'Licença',status:'apresentado',versionId:'v1'}]).ready,true);
});
test('AF-060..061 encaminhamento exige humano e fonte válida',()=>{
 const h=handoffFor(observed);
 assert.equal(h.mode,'assistido_sem_envio_automatico');
 assert.ok(h.steps.some(x=>x.includes('habilitado')));
});
test('AF-062..065 eventos declarados não se transformam em valores sem prova',()=>{
 const cases=[{id:'case-1',project_id:'project-1',source:'bndes'}];
 const ev=[{case_id:'case-1',revision:1,event_kind:'award_verification',value_cents:'5000',evidence_url:null},
  {case_id:'case-1',revision:2,event_kind:'disbursement_verification',value_cents:'3000',evidence_url:'https://cidades.bndes.gov.br/'}];
 const r=operationalOutcomes(cases,ev);
 assert.equal(r.declaredAwardCents,'0');
 assert.equal(r.declaredPaidCents,'3000');
 assert.equal(r.awarded,0);
});
test('AF-051..065 domínio tem tipos e datas estáveis',()=>{
 assert.equal(EVENT_TYPES.length,11);assert.equal(MODALITIES.length,5);
 assert.equal(validDate('2026-02-30'),false);
 assert.equal(fingerprint({a:1}).length,64);
});
