import test from 'node:test';
import assert from 'node:assert/strict';
import {validNormativeVersion,normativeVersionLabel} from '../lib/normative-source.mjs';

const base={sourceUrl:'https://www.gov.br/consulta/lei-2026',
 publishedOn:'2025-04-01',validFrom:'2026-01-01',validUntil:null};
test('AF-028: vigência civil da referência e fonte HTTPS sem URL privada',()=>{
 assert.deepEqual(validNormativeVersion(base,'2026-11-07'),base);
 assert.deepEqual(validNormativeVersion({...base,validUntil:''},'2026-11-07'),base);
 assert.deepEqual(validNormativeVersion({...base,validUntil:'2026-11-09'},'2026-11-07'),
  {...base,validUntil:'2026-11-09'});
 assert.equal(validNormativeVersion({...base,publishedOn:'2027-01-01'},'2026-11-07'),null);
 assert.equal(validNormativeVersion({...base,publishedOn:'2025-02-30'},'2026-11-07'),null);
 assert.equal(validNormativeVersion({...base,validFrom:'2026-02-30'},'2026-11-07'),null);
 assert.equal(validNormativeVersion({...base,validUntil:'2025-12-31'},'2026-11-07'),null);
 assert.equal(validNormativeVersion({...base,validUntil:'2026-02-30'},'2026-11-07'),null);
 assert.equal(validNormativeVersion({...base,sourceUrl:'http://www.gov.br'},'2026-11-07'),null);
 assert.equal(validNormativeVersion({...base,sourceUrl:'https://127.0.0.1/lei'},'2026-11-07'),null);
 assert.equal(validNormativeVersion({...base,sourceUrl:'https://meu.portal.internal/lei'},'2026-11-07'),null);
 assert.equal(validNormativeVersion({...base,sourceUrl:'https://site.gov.br/lei?x=1'},'2026-11-07'),null);
 assert.equal(normativeVersionLabel('2027-01-01',null,'2026-11-07'),
  'Início informado no futuro');
 assert.equal(normativeVersionLabel('2025-01-01','2025-12-31','2026-11-07'),
  'Término informado ultrapassado');
 assert.equal(normativeVersionLabel('2026-01-01',null,'2026-11-07'),
  'Período informado — conferir na fonte');
});
