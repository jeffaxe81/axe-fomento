# Axes Fomento — Plataforma para captação de recursos públicos

> **V1.1 · em homologação.** O radar usa oportunidades fictícias de demonstração; não há coleta oficial nem garantia de elegibilidade. A PR de RLS reforça o isolamento entre prefeituras, mas **não substitui o penteste**.

## Funcionalidades disponíveis

- Login institucional com cookie HttpOnly e token assinado, expirando em oito horas.
- Perfil municipal com UF, código IBGE, população e prioridades; somente administradores editam.
- Radar com busca, filtros e nota **preliminar** de aderência, nunca parecer técnico ou jurídico.
- Projetos vinculados ao município autenticado e acompanhamento no dashboard.
- **RLS PostgreSQL** para prefeituras, usuários e projetos. O contexto do município é obrigatório e restrito a uma única transação; dados de oportunidades são públicos.
- Usuário PostgreSQL `fomento_app` sem privilégios administrativos, sem BYPASSRLS e sem acesso direto aos hashes de senha.
- Funções SQL restritas para localizar credenciais no login e revalidar a sessão.
- Testes unitários, testes de RLS com dois municípios e pipeline de CI.

## Instalação com Docker Compose (recomendada)

Requer Docker/Compose. Configure `.env` com três segredos distintos:

```bash
cp .env.example .env
# Edite POSTGRES_PASSWORD, APP_DB_PASSWORD (>=24) e SESSION_SECRET (>=32).
docker compose up -d db
# Migrações e criação do papel runtime são executadas SEM manter credenciais
# administrativas no serviço web:
docker compose --profile setup run --rm setup
# Dados EXCLUSIVAMENTE fictícios:
docker compose --profile setup run --rm setup npm run db:seed
# Primeiro administrador — use credenciais próprias e apenas ambiente de teste:
docker compose --profile setup run --rm \
  -e ADMIN_EMAIL=admin@exemplo.gov.br \
  -e ADMIN_PASSWORD='SenhaForteGeradaParaHomologacao123!' \
  -e ADMIN_NAME='Administrador Municipal' \
  -e MUNICIPALITY_NAME='Cidade de Teste' \
  -e MUNICIPALITY_UF=SC \
  setup npm run admin:bootstrap
docker compose up -d --build web
```

Acesso em `http://localhost:3000` pelo próprio host; use reverse proxy TLS para acesso externo. **Nunca expor PostgreSQL, nem as credenciais administrativas ao processo web.** A aplicação web exige `PGUSER=fomento_app` e recusa `DATABASE_URL` (reservada à migração).

### Desenvolvimento local sem Docker

Configure o PostgreSQL 17 e rode os comandos administrativos **com `DATABASE_URL` apenas no processo CLI**, sem salvá-la em `.env` (carregado pelo Next.js):

```bash
npm install --no-audit --no-fund
DATABASE_URL='postgresql://admin:senha@localhost:5432/fomento' npm run db:migrate
DATABASE_URL='postgresql://admin:senha@localhost:5432/fomento' \
  APP_DB_PASSWORD='senha_app_aleatoria_de_24_ou_mais' npm run db:provision
# Atualize PGHOST, PGUSER=fomento_app, PGPASSWORD no .env e inicie:
npm run dev
```

O bootstrap administrativo é obrigatório para o primeiro login. Credenciais reais devem vir de gerenciador de segredos, nunca de comandos versionados ou logs de CI.

### Atualização de instalações V1

1. Efetue backup testado do PostgreSQL e preserve uma janela de rollback.
2. Atualize o código, aplique `db:migrate` e depois `db:provision`, usando papel de migração.
3. Troque as credenciais do web para `fomento_app` e remova qualquer `DATABASE_URL` administrativa do serviço web.
4. Rode a suíte de integração e valide perfis de **duas** prefeituras antes de abrir acesso.

**Atenção:** o runtime antigo, usando o dono do banco, contornava o isolamento por RLS. A troca de credenciais é obrigatória; não basta aplicar o SQL. O provisionamento é idempotente, mas concede/revoga permissões: revise a janela de implantação.

## Testes e segurança

```bash
npm test         # lógica de matching
npm run lint     # compilação de tipos TypeScript
npm run build    # compilação Next.js
# Depois de executar migrate e provision com PostgreSQL:
RLS_TEST_ADMIN_URL='postgresql://admin:...@localhost:5432/fomento' \
RLS_TEST_APP_URL='postgresql://fomento_app:...@localhost:5432/fomento' \
npm run test:db
```

A integração verifica acesso cruzado entre municípios, operações negadas, ausência de contexto, expiração do contexto após COMMIT, usuário sem BYPASSRLS e separação das funções de autenticação. CI executa isso com PostgreSQL 17.

**Pontos pendentes para produção:** MFA; proteção distribuída contra força bruta; revisão de CSRF/origem; auditoria; backup e recuperação testados; penteste independente; integração e validação dos editais em fontes oficiais; LGPD; testes end-to-end. Não liberar a plataforma publicamente antes da homologação.

## Roadmap

| Versão | Conteúdo |
|---|---|
| V1 | Radar, perfil municipal e organização de projetos |
| V1.1 | RLS, fontes oficiais verificáveis, segurança, auditoria e homologação |
| V2 | Inteligência jurídica, documentos e simulação financeira com revisão humana |
| V3 | Fontes internacionais e rede de fomento |
| V4 | Analisador de propostas com nota preliminar, lacunas e recomendações explicáveis |

### Modelo de ameaça do contexto RLS

O parâmetro `app.municipality_id` não é prova criptográfica de identidade: qualquer sessão PostgreSQL com execução arbitrária de SQL poderia defini-lo. A aplicação precisa impedir SQL arbitrário, validar o JWT assinado e sempre derivar o município da sessão. A defesa de banco evita vazamentos por consultas sem filtro, mas não substitui prevenção de SQL injection e penteste.
