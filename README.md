# Axes Fomento — Inteligência em Captação de Recursos Públicos

Plataforma web para apoiar municípios na identificação de oportunidades de fomento, triagem inicial de elegibilidade e organização de projetos de captação.

> **V1 · MVP em validação.** Editais de amostra são explicitamente fictícios. Não há conexão ativa com portais oficiais nesta entrega. A pontuação não é parecer jurídico nem certificação de elegibilidade.

## Funcionalidades V1
- Login institucional com sessão assinada, validade de oito horas, cookie HttpOnly e revogação de sessão no PostgreSQL.\n- Autenticação em dois fatores TOTP opcional pelo menu **Segurança da conta**, com chaves criptografadas e bloqueio de reutilização de código.
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

Configure `.env` com `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD` (24+ caracteres e diferente do admin), `SESSION_SECRET`, `MFA_ENCRYPTION_KEY` e `APP_ORIGIN`. Para backup, configure `BACKUP_ENCRYPTION_KEY` diferente da chave MFA.

```bash
docker compose up -d db
docker compose --profile setup run --rm setup npm run db:migrate
docker compose --profile setup run --rm setup npm run db:provision
docker compose --profile setup run --rm setup npm run db:seed
# Para bootstrap: execute npm run admin:bootstrap no serviço efêmero setup, com ADMIN_*.
docker compose up -d --build web
```

O servidor web não recebe credenciais administrativas. Veja `docs/SEGURANCA_TESTES.md`. Use HTTPS para acesso remoto. As instruções de MFA, backup criptografado, ensaio de restauração, Nginx e pendências de homologação estão em [`docs/PLANO_4_SEMANAS_SEGURANCA.md`](docs/PLANO_4_SEMANAS_SEGURANCA.md).

## Segurança e limitações
- A branch de segurança incorpora RLS PostgreSQL, transações por município, role de aplicativo limitada, auditoria e limitação persistente de login; exige homologação.
- A branch antecipada dispõe de MFA TOTP opcional, revogação de sessões, rate limiting distribuído e auditoria básica, mas **ainda não conta com recuperação self-service de MFA nem trilha imutável externa**. Também faltam conector oficial de editais e verificador jurídico; não há autorização para uso público.
- O endpoint de saúde (`GET /api/health`) verifica o banco, sem dados privados.
- URLs e registros de exemplo não constituem oportunidades reais.
- Cadastro público de administradores fica desabilitado: use exclusivamente o CLI de bootstrap.

## Roadmap
| Versão | Escopo |
| --- | --- |
| V1 | Radar, perfil municipal, projetos e filtros iniciais |
| V1.1 | Ingestão oficial verificável, homologação de RLS, auditoria, controles de segurança e gestão de ciclo de vida (PRs em validação) |
| V2 | Inteligência jurídica, análise documental, IA/RAG e simulador financeiro |
| V3 | Rede nacional e internacional de fomento |
| V4 | Avaliador inteligente de propostas (nota, parecer preliminar, lacunas e recomendações) |

## Testes
`npm test` executa o algoritmo de match; `npm run lint` valida TypeScript. Há testes de integração e segurança no CI. Ainda faltam homologação de instalação, caixa-preta completa e verificação independente.
