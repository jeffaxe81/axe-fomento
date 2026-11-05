import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPrograms, normalizeProgram, SOURCE_URL } from '../lib/transferegov-normalize.mjs';
test('normalizador utiliza campos explícitos e URL segura do catálogo oficial',()=>{
  const row=normalizeProgram({id_programa:123,nome_programa:' Programa de Saúde ',nome_orgao:'Ministério de exemplo',prazo:'2026-12-31',valor:10000});
  assert.deepEqual(row,{
    externalId:'123',title:'Programa de Saúde',provider:'Ministério de exemplo',sourceUrl:SOURCE_URL,
  });
  assert.equal('deadline' in row,false);
  assert.equal('fundingAmount' in row,false);
});
test('normalizador recusa identificador/título ausentes, sem inferir oportunidade',()=>{
  assert.equal(normalizeProgram({id_programa:15}),null);
  assert.equal(normalizeProgram({nome_programa:'X'}),null);
  assert.equal(normalizeProgram({id_programa:1,nome_programa:''.padEnd(200,'X')}),null);
  assert.equal(normalizeProgram(null),null);
});
test('coleta normaliza envelope, elimina duplicatas e limita amostra',()=>{
  const data=[{id_programa:'001',nome_programa:'A'},
    {id_programa:'001',nome_programa:'A duplicado'},
    {id_programa:'002',nome_programa:'B'}];
  assert.deepEqual(extractPrograms({data},2).map(x=>x.title),['A','B']);
  assert.deepEqual(extractPrograms([]),[]);
  assert.throws(()=>extractPrograms({foo:data}),/Formato/);
  assert.throws(()=>extractPrograms([{registro:'nada'}]),/incompatíveis/);
  assert.throws(()=>extractPrograms(Array.from({length:2001},()=>({}))),/volume/);
});
