import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assessEnvironment,assessStaticDeployment,FEATURE_FLAGS,validOrigin} from '../lib/ops-readiness.mjs';
const key=Buffer.alloc(32,7).toString('base64');
const good=()=>({
 POSTGRES_PASSWORD:'a'.repeat(32),POSTGRES_APP_PASSWORD:'b'.repeat(32),
 SESSION_SECRET:'s'.repeat(48),
 MFA_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),
 BACKUP_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64'),
 ATTACHMENT_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64'),
 APP_ORIGIN:'https://fomento.example.gov.br',TRUST_PROXY_IP:'false',
 ...Object.fromEntries(FEATURE_FLAGS.map(x=>[x,'no']))
});
test('OP guard: configuração aceita URL TLS, chaves diferentes e flags fechadas',()=>{
 assert.equal(assessEnvironment(good()).ok,true);
 assert.equal(validOrigin('https://fomento.example.gov.br'),true);
});
test('OP guard: segredos nunca aparecem em erros de configuração',()=>{
 const env=good();env.POSTGRES_APP_PASSWORD='weak';env.APP_ORIGIN='http://localhost:3000';
 env.BACKUP_ENCRYPTION_KEY=env.MFA_ENCRYPTION_KEY;env.ENABLE_READINESS_EVALUATOR='enabled';
 const r=assessEnvironment(env);
 assert.equal(r.ok,false);
 assert.ok(r.problems.some(x=>x.includes('POSTGRES_APP_PASSWORD')));
 assert.ok(r.problems.some(x=>x.includes('APP_ORIGIN')));
 assert.ok(r.problems.some(x=>x.includes('distintas')));
 assert.ok(r.problems.some(x=>x.includes('ENABLE_READINESS_EVALUATOR')));
 assert.ok(!r.problems.join(' ').includes(env.POSTGRES_PASSWORD));
 assert.ok(!r.problems.join(' ').includes(env.MFA_ENCRYPTION_KEY));
});
test('OP guard: exige senhas URL-safe, separação do banco e bloqueia exemplos',()=>{
 const env=good();env.POSTGRES_PASSWORD='a'.repeat(25)+'@';
 env.SESSION_SECRET='curta';env.MFA_ENCRYPTION_KEY='GERAR_CHAVE';
 assert.equal(assessEnvironment(env).ok,false);
});
test('OP guard: origem não contém credenciais, portas locais ou caminho',()=>{
 for(const origin of ['http://site.gov.br','https://localhost','https://127.0.0.1',
  'https://user:pass@site.gov.br','https://site.gov.br/caminho',
  'https://site.gov.br/?query=1']){
  assert.equal(validOrigin(origin),false,origin);
 }
});
test('OP guard: arquivos do deployment cumprem regras verificáveis',async()=>{
 const root=new URL('../',import.meta.url);
 const [compose,nginx,dockerfile]=await Promise.all([
  readFile(new URL('docker-compose.yml',root),'utf8'),
  readFile(new URL('deploy/nginx-fomento.conf.example',root),'utf8'),
  readFile(new URL('Dockerfile',root),'utf8')
 ]);
 assert.deepEqual(assessStaticDeployment(compose,nginx,dockerfile).problems,[]);
});
test('OP guard: detectar remoção de flag, exposição de admin e upload bloqueado',()=>{
 const compose='\n  web:\n    environment:\n      DATABASE_ADMIN_URL: bad\n    ports: ["0.0.0.0:3000:3000"]\nvolumes:\n';
 const r=assessStaticDeployment(compose,'client_max_body_size 1m;','USER root');
 assert.equal(r.ok,false);
 assert.ok(r.problems.some(x=>x.includes('credenciais administrativas')));
 assert.ok(r.problems.some(x=>x.includes('uploads')));
 assert.ok(r.problems.some(x=>x.includes('USER'))||r.problems.some(x=>x.includes('sem root')));
});
