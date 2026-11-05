import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDate,todaySaoPaulo,daysToExpiry,expiryStatus,expiryWithin}
 from '../lib/document-validity.mjs';

test('AF-019: validade exige data civil real, inclusive ano bissexto',()=>{
 assert.equal(validateDate('2024-02-29'),true);
 assert.equal(validateDate('2026-02-29'),false);
 assert.equal(validateDate('2026-11-31'),false);
 assert.equal(validateDate('2026-00-05'),false);
 assert.equal(validateDate('2026-11-05'),true);
 assert.equal(validateDate('2026-1-5'),false);
 assert.equal(validateDate(null),false);
 assert.equal(validateDate('9999-99-99'),false);
});
test('AF-019: hoje considera o fuso de Brasília sem depender do servidor CI',()=>{
 assert.equal(todaySaoPaulo(new Date('2026-11-06T02:00:00Z')),'2026-11-05');
 assert.equal(todaySaoPaulo(new Date('2026-11-06T04:00:00Z')),'2026-11-06');
 assert.equal(todaySaoPaulo(new Date('2026-03-01T02:00:00Z')),'2026-02-28');
});
test('AF-019: faixas vencido, hoje, 7, 30 e 90 dias são inclusivas',()=>{
 const today='2026-11-05';
 assert.equal(daysToExpiry('2026-11-04',today),-1);
 assert.equal(daysToExpiry('2026-11-05',today),0);
 assert.equal(daysToExpiry('2026-11-12',today),7);
 assert.equal(daysToExpiry('2026-12-05',today),30);
 assert.equal(daysToExpiry('2027-02-03',today),90);
 assert.equal(daysToExpiry('2027-02-04',today),91);
 assert.equal(expiryStatus(null,today).kind,'unknown');
 assert.equal(expiryStatus('2026-11-04',today).kind,'expired');
 assert.equal(expiryStatus('2026-11-05',today).kind,'due7');
 assert.equal(expiryStatus('2026-11-12',today).kind,'due7');
 assert.equal(expiryStatus('2026-11-13',today).kind,'due30');
 assert.equal(expiryStatus('2026-12-05',today).kind,'due30');
 assert.equal(expiryStatus('2027-02-03',today).kind,'due90');
 assert.equal(expiryStatus('2027-02-04',today).kind,'current');
});
test('AF-019: filtros incluem vencidos sem inventar data quando ausente',()=>{
 const today='2026-11-05';
 const expired=expiryStatus('2026-11-01',today);
 const short=expiryStatus('2026-11-12',today);
 const mid=expiryStatus('2026-12-05',today);
 const far=expiryStatus('2027-04-01',today);
 assert.equal(expiryWithin(expired,'expired'),true);
 assert.equal(expiryWithin(short,'expired'),false);
 assert.equal(expiryWithin(expired,'7'),true);
 assert.equal(expiryWithin(short,'7'),true);
 assert.equal(expiryWithin(mid,'7'),false);
 assert.equal(expiryWithin(mid,'30'),true);
 assert.equal(expiryWithin(far,'90'),false);
 assert.equal(expiryWithin(far,'all'),true);
 assert.equal(expiryWithin(expiryStatus(null,today),'all'),false);
});
