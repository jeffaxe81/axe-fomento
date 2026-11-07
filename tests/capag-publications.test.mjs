import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCapagResources,fetchCapagCatalog,DATASET_URL} from '../lib/capag-publications.mjs';
const valid={
 success:true,result:{resources:[
  {id:'a',name:'Capag Municípios 2026 - 01/09/2026',
   url:'https://www.tesourotransparente.gov.br/ckan/dataset/abc/resource/xyz/download/capag-2026.xlsx',
   format:'XLSX',size:'24500000'},
  {id:'b',name:'Capag Municípios 2025 - 19/02/2025',
   url:'https://www.tesourotransparente.gov.br/ckan/dataset/abc/resource/old/download/capag-2025.xlsx',
   format:'XLSX',size:'23000000'}
 ]}};
test('AF-053 lista versão mais recente, sem inventar nota individual ou ano-base',()=>{
 const r=normalizeCapagResources(valid);
 assert.equal(r.length,2);assert.equal(r[0].publishedForYear,2026);
 assert.equal(r[0].publicationDate,'2026-09-01');
 assert.equal('classification' in r[0],false);
});
test('AF-053 bloqueia URLs externas, formato não XLSX e payload incompatível',()=>{
 const bad=structuredClone(valid);
 bad.result.resources.push({name:'Capag 2026',url:'https://malicious.example/download/data.xlsx',format:'XLSX'});
 assert.equal(normalizeCapagResources(bad).length,2);
 assert.throws(()=>normalizeCapagResources({success:true,result:{resources:{}}}));
});
test('AF-053 busca somente endpoint fixo e ignora certificados de resultado',async()=>{
 const fake=async(url,opts)=>{
  assert.equal(url,DATASET_URL);assert.equal(opts.redirect,'error');
  return new Response(JSON.stringify(valid),{headers:{'content-type':'application/json'}});
 };
 const result=await fetchCapagCatalog(fake);
 assert.equal(result[0].name,valid.result.resources[0].name);
});
