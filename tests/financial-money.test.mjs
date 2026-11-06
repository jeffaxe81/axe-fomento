import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBRLToCents,formatBRLCents,moneyDifferenceCents} from '../lib/financial-money.mjs';

test('AF-024: precisão em centavos e aceitação de entrada BRL com separador único',()=>{
 assert.equal(parseBRLToCents('1'), '100');
 assert.equal(parseBRLToCents('12,5'),'1250');
 assert.equal(parseBRLToCents('12.50'),'1250');
 assert.equal(parseBRLToCents('0001,03'),'103');
 assert.equal(parseBRLToCents('0'),'0');
 assert.equal(parseBRLToCents('999999999999,99'),'99999999999999');
 for(const v of [0,undefined,null,'','-1','1,234','1.234,56','1,234.56',
  '1e4',' 1,00','1,00 ','1.','01_00','1000000000000','NaN',{}]){
  assert.equal(parseBRLToCents(v),null,String(v));
 }
 assert.equal(formatBRLCents('0'),'R$ 0,00');
 assert.equal(formatBRLCents('1250'),'R$ 12,50');
 assert.equal(formatBRLCents('99999999999999'),'R$ 999.999.999.999,99');
 assert.equal(moneyDifferenceCents('1250','1249'),'-1');
 assert.equal(moneyDifferenceCents('1249','1250'),'1');
});
