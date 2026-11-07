import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {buildReadinessPdf} from '../lib/readiness-pdf.mjs';
test('AF-050: PDF válido em A4, com dados versionados e várias seções',async()=>{
 const bytes=await buildReadinessPdf({
  caseInfo:{id:'a',kind:'idea',title:'Apoio comunitário no bairro',problem:'Problema social prioritário',
   target_audience:'Famílias da região',objective:'Melhorar serviços à população',author_name:'Autor Municipal'},
  assessment:{id:'b',revision:1,previous_id:null,author_name:'Analista responsável',
   score:82,maximum_possible_score:82,evaluated_weight:100,rubric_version:1,
   rubric_snapshot:[{id:'solucao',label:'Solução técnica',weight:100}],
   scores_snapshot:[{id:'solucao',score:82,evidence:'Documento enviado pelo município'}],
   blockers_snapshot:[{code:'documentacao',rule:'Documento pendente',evidence:'Protocolo ainda não conferido'}],
   action_plan_snapshot:[{id:'crit-solucao',priority:'media',reason:'Aprimoramento',
    recommendation:'Conferir documentação com a equipe.',impact:18}],
   evidence_snapshot:[],snapshot_sha256:'a'.repeat(64),revision_note:'Análise preliminar',
   created_at:'2026-11-07T10:00:00Z'},reviews:[],assignments:[]});
 assert.equal(Buffer.from(bytes.subarray(0,5)).toString(),'%PDF-');
 const doc=await PDFDocument.load(bytes);
 assert.ok(doc.getPageCount()>=1);
 assert.deepEqual(doc.getPage(0).getSize(),{width:595,height:842});
});
