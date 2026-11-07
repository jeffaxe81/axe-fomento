import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuantityMilli,budgetLineTotalCents,formatQuantityMilli,budgetInput} from '../lib/budget-math.mjs';

test('AF-025: quantidade milésimos aceita vírgula ou ponto, sem Float',()=>{
 const valid={'0,001':'1','0.01':'10','0,1':'100','1':'1000',
  '1,234':'1234','12.5':'12500','999999,999':'999999999'};
 for(const [v,want] of Object.entries(valid))assert.equal(parseQuantityMilli(v),want,v);
 for(const v of ['0','0,000','0.000','0,0001','1.000,000','1,000.000',
  '1e3','-1',' 1','1 ','1.','01,000','1000000','999999,9999',
  null,undefined,12345,{},'NaN'])
  assert.equal(parseQuantityMilli(v),null,String(v));
 assert.equal(formatQuantityMilli('1234'),'1,234');
 assert.equal(formatQuantityMilli('1000'),'1');
 assert.equal(formatQuantityMilli('12300'),'12,3');
 assert.equal(formatQuantityMilli('1'),'0,001');
});
test('AF-025: custo por item arredonda meio centavo para cima, em inteiros',()=>{
 assert.equal(budgetLineTotalCents('1000','1001'),'1001');
 assert.equal(budgetLineTotalCents('1500','1001'),'1502');
 assert.equal(budgetLineTotalCents('500','1'),'1');
 assert.equal(budgetLineTotalCents('499','1'),'0');
 assert.equal(budgetLineTotalCents('1','0'),'0');
 assert.equal(budgetLineTotalCents('999999999','99999999999999'),null);
 assert.equal(budgetLineTotalCents('0','100'),null);
 assert.equal(budgetLineTotalCents('-1','1'),null);
 assert.equal(budgetLineTotalCents('1','-1'),null);
 assert.deepEqual(budgetInput('2,5','99,95'),{
  quantityMilli:'2500',unitCostCents:'9995',totalCents:'24988'
 });
 assert.equal(budgetInput('999999,999','999999999999,99'),null);
 assert.equal(budgetInput('1,2','1.000,00'),null);
 assert.equal(budgetInput('0,001','0,00')?.totalCents,'0');
});
