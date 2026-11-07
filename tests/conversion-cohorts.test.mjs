import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeConversionRange,percentOf,CONVERSION_COHORTS_SQL} from '../lib/conversion-cohorts.mjs';
test('AF-041: período civil válido e não invertido',()=>{
 assert.deepEqual(normalizeConversionRange('2026-01-01','2026-12-31'),{from:'2026-01-01',to:'2026-12-31'});
 for(const [a,b] of [['2026-02-30','2026-03-01'],['2026-12-31','2026-01-01'],['2026-01-01','2026-13-01']]) assert.equal(normalizeConversionRange(a,b),null);
});
test('AF-041: denominador explícito e status da coorte',()=>{
 assert.equal(percentOf(3,10),'30,0%');assert.equal(percentOf(0,2),'0,0%');assert.equal(percentOf(0,0),'—');
 assert.match(CONVERSION_COHORTS_SQL,/PARTITION BY e.project_id,e.portal_host/);
 assert.match(CONVERSION_COHORTS_SQL,/e.submitted_on BETWEEN/);
});
