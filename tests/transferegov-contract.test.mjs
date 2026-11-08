import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOfficialContract,fetchOfficialContract,OFFICIAL_CONTRACTS} from '../lib/transferegov-contract.mjs';
const fixture={openapi:'3.1.0',info:{title:'Transferegov API'},paths:{
 '/programa':{get:{responses:{'200':{description:'OK'}}}},
 '/parcerias/{id}':{get:{responses:{'200':{description:'OK'}}}},
 '/registro':{post:{responses:{'201':{description:'OK'}}}}
}};
test('V1: contrato de rotas não certifica edital disponível ou elegibilidade',()=>{
 const r=inspectOfficialContract(fixture,'parcerias');
 assert.equal(r.documentedRoutes,2);assert.equal(r.programEndpointDescribed,true);
 assert.equal(r.automaticallyPublishable,false);
 assert.equal(r.candidateRoutes.length,1);
 assert.equal(r.sha256.length,64);
 assert.equal(r.schemaUrl,OFFICIAL_CONTRACTS.parcerias.url);
});
test('V1: documentação de novos atos preparatórios não é edital aberto',()=>{
 const r=inspectOfficialContract({...fixture,paths:{'/atos-preparatorios':{get:{}},'/editais':{get:{}}}},'discricionarias');
 assert.equal(r.documentedRoutes,2);assert.equal(r.automaticallyPublishable,false);
});
test('V1: falha fechada em origem arbitrária, JSON inesperado e rota maliciosa',()=>{
 assert.throws(()=>inspectOfficialContract(fixture,'unknown'));
 assert.throws(()=>inspectOfficialContract({openapi:'3.1.0',paths:{}},'parcerias'));
 assert.throws(()=>inspectOfficialContract({openapi:'3.1.0',paths:{'//evil':{get:{}}}},'parcerias'));
 assert.throws(()=>inspectOfficialContract({openapi:'2.0.0',paths:fixture.paths},'parcerias'));
});
test('V1: consulta apenas endereço fixo HTTPS sem redirecionar e tamanho limitado',async()=>{
 const seen=[];
 const fake=async(url,opts)=>{
  seen.push(url);assert.equal(opts.redirect,'error');
  return new Response(JSON.stringify(fixture),{headers:{'content-type':'application/json'}});
 };
 const result=await fetchOfficialContract('parcerias',fake);
 assert.equal(seen[0],OFFICIAL_CONTRACTS.parcerias.url);
 assert.equal(result.documentedRoutes,2);
 await assert.rejects(fetchOfficialContract('invalid',fake));
 await assert.rejects(fetchOfficialContract('parcerias',async()=>new Response('<html>bad</html>',{
  headers:{'content-type':'text/html'}})));
 await assert.rejects(fetchOfficialContract('parcerias',async()=>
  new Response(JSON.stringify({openapi:'3.1.0',paths:{}}),{headers:{'content-type':'application/json'}})));
 await assert.rejects(fetchOfficialContract('parcerias',async()=>new Response('x'.repeat(2*1024*1024+1),{
  headers:{'content-type':'application/json'}})));
});
