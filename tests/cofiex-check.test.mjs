import test from 'node:test';
import assert from 'node:assert/strict';
import {COFIEX_STATES,validCofiexCheck,cofiexStatusAge} from '../lib/cofiex-check.mjs';
const today='2026-11-07';
const valid={stageCode:'acessar_pfe',expectedRevision:0,
 consultationState:'em_preparacao',consultedOn:'2026-11-05',
 note:'O município registrou consulta à página do PFE e deve verificar requisitos atuais.',
 acknowledgedLimits:true};

test('AF-036: check documental interno não equivale a envio formal',()=>{
 assert.equal(Object.keys(COFIEX_STATES).length,4);
 assert.match(COFIEX_STATES.conferido_internamente,/sem validação externa/);
 assert.deepEqual(validCofiexCheck(valid,today),valid);
 assert.equal(validCofiexCheck({...valid,acknowledgedLimits:false},today),null);
 assert.equal(validCofiexCheck({...valid,consultationState:'aprovado_cofiex'},today),null);
 assert.equal(validCofiexCheck({...valid,consultedOn:'2026-11-08'},today),null);
 assert.equal(validCofiexCheck({...valid,consultedOn:'2026-02-30'},today),null);
 assert.equal(validCofiexCheck(null,today),null);
});
test('AF-036: alerta de conferência antiga sem inferir vigência de norma',()=>{
 assert.equal(cofiexStatusAge(null,today),'Sem conferência interna registrada');
 assert.match(cofiexStatusAge('2026-05-01',today),/90/);
 assert.match(cofiexStatusAge('2026-11-07',today),/altera/);
 assert.equal(cofiexStatusAge('2026-02-30',today),'Data inválida');
});
