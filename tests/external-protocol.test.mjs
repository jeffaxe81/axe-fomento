import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePortal,validProtocolDate} from '../lib/external-protocol.mjs';

test('AF-022: URL exige domínio público e HTTPS, sem credenciais ou query',()=>{
 const valid=normalizePortal('https://CONVENIOS.GOV.BR/consultar');
 assert.deepEqual(valid,{url:'https://convenios.gov.br/consultar',host:'convenios.gov.br'});
 assert.deepEqual(normalizePortal('https://www.gov.br/'),{
  url:'https://www.gov.br/',host:'www.gov.br'});
 for(const input of [
  'http://www.gov.br','https://localhost/','https://127.0.0.1/',
  'https://[::1]/','https://intranet.local/','https://portal.example/',
  'https://portal.invalid/','https://portal.gov.br:8080/',
  'https://fulano:senha@portal.gov.br/','https://portal.gov.br/?token=segredo',
  'https://portal.gov.br/#secret','file:///etc/passwd','javascript:alert(1)',
  'https://portal..gov.br/','https://-portal.gov.br/','https://portal.gov.br:8443/',
  '',null,42,'https://porta.test/',
 ]){
  assert.equal(normalizePortal(input),null,String(input));
 }
});
test('AF-022: validade da data do protocolo usa calendário e fuso civil',()=>{
 const today='2026-11-06';
 assert.equal(validProtocolDate('2026-11-06',today),true);
 assert.equal(validProtocolDate('2026-11-05',today),true);
 assert.equal(validProtocolDate('2026-11-07',today),false);
 assert.equal(validProtocolDate('2026-02-30',today),false);
 assert.equal(validProtocolDate('2024-02-29',today),true);
 assert.equal(validProtocolDate('1999-12-31',today),false);
 assert.equal(validProtocolDate('2101-01-01',today),false);
 assert.equal(validProtocolDate('2026-11-6',today),false);
});
