import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {renderReadinessPdf} from '../lib/readiness-pdf.mjs';
test('AF-050: PDF com cabeçalho e múltiplas páginas recuperáveis',async()=>{
 const doc=await renderReadinessPdf({title:'Pré-avaliação municipal 001',sections:[
  {title:'Nota e evidências',lines:Array.from({length:130},(_,i)=>'Evidência de referência '+i+' com longa justificativa e fonte pública declarada para verificação humana.')}
 ]});
 assert.equal(new TextDecoder().decode(doc.slice(0,8)).startsWith('%PDF-'),true);
 const parsed=await PDFDocument.load(doc);
 assert.ok(parsed.getPageCount()>1);
 assert.equal(parsed.getTitle(),'Pré-avaliação municipal 001');
});
