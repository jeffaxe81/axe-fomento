import test from 'node:test';
import assert from 'node:assert/strict';

if (process.env.RUN_TEST_DB_ISOLATION !== 'yes' || !process.env.TEST_BASE_URL) {
  throw new Error('Testes de segurança exigem ambiente de integração isolado.');
}
const base = process.env.TEST_BASE_URL;
const malicious = 'https://origem-nao-confiavel.example.invalid';

test('rotas que alteram dados rejeitam origem de outro site', async () => {
  const attempts = [
    ['/api/auth/login', 'POST', { email: 'a@example.invalid', password: 'x' }],
    ['/api/auth/logout', 'POST', {}],
    ['/api/projects', 'POST', { title: 'Projeto teste', opportunityId: 'f6a11da1-7b04-4fe4-b1b5-83ac5333ed9a' }],
    ['/api/municipality', 'PATCH', { population: 2, ibgeCode: null, priorityAreas: [] }]
  ];
  for (const [path, method, body] of attempts) {
    const response = await fetch(base + path, {
      method, headers: { origin: malicious, 'content-type': 'application/json' },
      body: JSON.stringify(body), redirect: 'manual'
    });
    assert.equal(response.status, 403, path + ' precisa barrar origem externa');
  }
});

test('requisições declaradas cross-site são bloqueadas mesmo sem Origin', async () => {
  const response = await fetch(base + '/api/auth/logout', {
    method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, redirect: 'manual'
  });
  assert.equal(response.status, 403);
});

test('rotas privadas recusam visitante não autenticado', async () => {
  const response = await fetch(base + '/projetos', { redirect: 'manual' });
  assert.ok([303, 307, 308].includes(response.status), 'Deve haver redirecionamento para login');
  assert.match(response.headers.get('location') ?? '', /\/login(?:\?|$)/);
  const creation = await fetch(base + '/api/projects', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Projeto teste', opportunityId: 'f6a11da1-7b04-4fe4-b1b5-83ac5333ed9a' })
  });
  assert.equal(creation.status, 401);
});

test('cabeçalhos protetivos impedem enquadramento em outros sites', async () => {
  const response = await fetch(base + '/login');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
});

test('falhas de login não revelam se a conta existe', async () => {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { origin: new URL(base).origin, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'nao-existe@example.invalid', password: 'senha-errada' })
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'Credenciais inválidas');
});
