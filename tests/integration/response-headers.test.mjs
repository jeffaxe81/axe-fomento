import test from 'node:test';
import assert from 'node:assert/strict';
if(process.env.RUN_TEST_DB_ISOLATION!=='yes'||!process.env.TEST_BASE_URL)
 throw new Error('Teste HTTP exige servidor CI isolado');
const base=process.env.TEST_BASE_URL;

test('Cabeçalhos e anti-CSRF aplicados no HTTPS edge e nas respostas de login',async()=>{
 const response=await fetch(base+'/login',{redirect:'manual'});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin');
 assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
 assert.equal(response.headers.get('strict-transport-security'),'max-age=31536000');
 const csp=response.headers.get('content-security-policy')||'';
 for(const directive of ["frame-ancestors 'none'","object-src 'none'","base-uri 'self'","form-action 'self'"])
   assert.ok(csp.includes(directive),'CSP ausente: '+directive);
 const attack=await fetch(base+'/api/auth/login',{
   method:'POST',headers:{'origin':'https://attacker.example.invalid','content-type':'application/json'},
   body:JSON.stringify({email:'x@example.invalid',password:'x'})
 });
 assert.equal(attack.status,403,'Escrita com origem externa deve falhar antes do login');
});
