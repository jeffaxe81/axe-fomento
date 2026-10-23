# Axes Fomento — Inteligência em Captação de Recursos Públicos

Plataforma web para apoiar municípios na identificação de oportunidades de fomento, triagem inicial de elegibilidade e organização de projetos de captação.

> **V1 · MVP em validação.** Editais de amostra são explicitamente fictícios. Não há conexão ativa com portais oficiais nesta entrega. A pontuação não é parecer jurídico nem certificação de elegibilidade.

## Funcionalidades V1
- Login institucional com sessão assinada, validade de oito horas e cookie HttpOnly.
- Município com prioridades, população e código IBGE. Administradores atualizam seu próprio município.
- Radar de oportunidades, busca por título/órgão e filtro por área.
- Índice preliminar de aderência (UF, prioridades, janela de prazo e limites populacionais disponíveis).
- Início de projetos a partir de oportunidades; projetos ficam associados ao município autenticado.
- Dashboard com resumo, iniciativas e projetos.
- Testes automáticos de classificação; CI de teste, tipos e compilação.

## Ambiente local (Node.js + PostgreSQL)

Requisitos: Node.js 22, npm e PostgreSQL 17 (ou Docker).

Crie `.env` com `DATABASE_ADMIN_URL` (só operações administrativas), `DATABASE_URL` (usuário `fomento_app`), `APP_DB_PASSWORD`, `SESSION_SECRET` e `APP_ORIGIN`.

```bash
npm install --no-audit --no-fund
npm run db:migrate
npm run db:provision
npm run db:seed
# Configure ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, MUNICIPALITY_NAME, MUNICIPALITY_UF
npm run admin:bootstrap
npm run dev
```

### Docker Compose

Configure `.env` com `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD` (24+ caracteres e diferente do admin), `SESSION_SECRET` e `APP_ORIGIN`.

```bash
docker compose up -d db
docker compose --profile setup run --rm setup npm run db:migrate
docker compose --profile setup run --rm setup npm run db:provision
docker compose --profile setup run --rm setup npm run db:seed
# Para bootstrap: execute npm run admin:bootstrap no serviço efêmero setup, com ADMIN_*.
docker compose up -d --build web
```

O servidor web não recebe credenciais administrativas. Veja `docs/SEGURANCA_TESTES.md`. Use HTTPS para acesso remoto.

## Segurança e limitações
- A branch de segurança incorpora RLS PostgreSQL, transações por município e role de aplicativo limitada; exige homologação.
- A V1 ainda não contém MFA, rate limiting distribuído, auditoria imutável, conector de editais oficiais nem verificador jurídico. Estes itens bloqueiam o uso público até a homologação.
- O endpoint de saúde (`GET /api/health`) verifica o banco, sem dados privados.
- URLs e registros de exemplo não constituem oportunidades reais.
- Cadastro público de administradores fica desabilitado: use exclusivamente o CLI de bootstrap.

## Roadmap
| Versão | Escopo |
| --- | --- |
| V1 | Radar, perfil municipal, projetos e filtros iniciais |
| V1.1 | Ingestão oficial verificável, homologação de RLS, auditoria, controles de segurança e gestão de ciclo de vida |
| V2 | Inteligência jurídica, análise documental, IA/RAG e simulador financeiro |
| V3 | Rede nacional e internacional de fomento |
| V4 | Avaliador inteligente de propostas (nota, parecer preliminar, lacunas e recomendações) |

## Testes
`npm test` executa o algoritmo de match; `npm run lint` valida TypeScript. Há testes de integração e segurança no CI. Ainda faltam homologação de instalação, caixa-preta completa e verificação independente.
