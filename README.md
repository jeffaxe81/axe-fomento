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

```bash
cp .env.example .env
# Configure DATABASE_URL e SESSION_SECRET (>=32 caracteres aleatórios).
npm install --no-audit --no-fund
npm run db:migrate
npm run db:seed
ADMIN_EMAIL=admin@exemplo.gov.br ADMIN_PASSWORD='SenhaAleatoriaMuitoForte123!' \
ADMIN_NAME='Administrador Municipal' MUNICIPALITY_NAME='Cidade de Teste' MUNICIPALITY_UF=SC \
npm run admin:bootstrap
npm run dev
```

Acesse `http://localhost:3000`.

### Docker Compose
Crie `.env` com `POSTGRES_PASSWORD`, `SESSION_SECRET` e opcionalmente `DATABASE_URL` para operações CLI. Não use senhas do exemplo em produção.

```bash
docker compose up -d --build
docker compose exec web npm run db:migrate
docker compose exec web npm run db:seed
docker compose exec -e ADMIN_EMAIL=admin@exemplo.gov.br \
  -e ADMIN_PASSWORD='SenhaAleatoriaMuitoForte123!' \
  -e ADMIN_NAME='Administrador Municipal' \
  -e MUNICIPALITY_NAME='Cidade de Teste' -e MUNICIPALITY_UF=SC \
  web npm run admin:bootstrap
```

> A porta 3000 expõe o serviço apenas no loopback do host. Use proxy reverso com TLS para acesso remoto. Ajuste firewalls e cookies seguros na implantação.

## Segurança e limitações
- Há escopo por município nas leituras e escritas de projetos e controle de função para editar o perfil.
- A V1 **ainda não contém** RLS no PostgreSQL, MFA, rate limiting distribuído, auditoria imutável, conector de editais oficiais nem verificador jurídico. Estes itens são bloqueadores para uso público/produção e constam no roadmap.
- O endpoint de saúde (`GET /api/health`) verifica o banco, sem dados privados.
- URLs e registros de exemplo não constituem oportunidades reais.
- Cadastro público de administradores fica desabilitado: use exclusivamente o CLI de bootstrap.

## Roadmap
| Versão | Escopo |
| --- | --- |
| V1 | Radar, perfil municipal, projetos e filtros iniciais |
| V1.1 | Ingestão oficial verificável, RLS, auditoria, controles de segurança e gestão de ciclo de vida |
| V2 | Inteligência jurídica, análise documental, IA/RAG e simulador financeiro |
| V3 | Rede nacional e internacional de fomento |
| V4 | Avaliador inteligente de propostas (nota, parecer preliminar, lacunas e recomendações) |

## Testes
`npm test` executa o algoritmo de match; `npm run lint` valida TypeScript. Para homologação antes de produção faltam testes de integração com banco, segurança e caixa-preta.
