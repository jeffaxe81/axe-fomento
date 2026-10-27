# AXE Fomento — proteções no PostgreSQL

## Implementado na branch em validação
- RLS em `municipalities`, `users` e `projects`, com bloqueio por padrão quando o contexto municipal não existe.
- `fomento_app`: conta sem SUPERUSER/BYPASSRLS e sem acesso direto aos hashes de senha.
- Cada consulta a dados municipais usa transação com `app.tenant_id` derivado da sessão autenticada. O contexto desaparece no COMMIT/ROLLBACK, impedindo vazamento entre conexões reutilizadas.
- Autenticação via funções `SECURITY DEFINER` e concessão de execução apenas à role da aplicação.
- Chave estrangeira composta impede associar responsáveis de outra prefeitura aos projetos.
- CI testa isolamento de duas prefeituras diretamente no PostgreSQL, além dos testes HTTP anteriores.

## Proteções adicionais propostas (migração 003)
- Tentativas de login controladas em tabela PostgreSQL, com contadores atômicos compartilhados entre instâncias: até cinco tentativas por identificação em janela fixa de 15 minutos; após exceder, HTTP 429 com Retry-After.
- O e-mail é usado somente para criar uma chave HMAC, sem persistir endereços ou IPs em texto puro na tabela de limitação. Não armazenar a senha de login em logs.
- Limitação adicional por IP (30 requisições em 15 min) somente com `TRUST_PROXY_IP=true` e proxy reverso de confiança que **substitua**, em vez de repassar, `X-Real-IP`. Sem proxy configurado, permanece limitação por conta, não por IP.
- JWT recebe identificador de sessão persistida no banco. `auth_session_user` exige token válido e sessão não revogada e não expirada. Logout revoga a sessão no banco. **A migração invalida os cookies JWT antigos**: usuários devem entrar novamente.
- Triggers de auditoria registram município, tipo de alteração, registro e, quando a ação passa pela API autenticada, o usuário autor de mudanças em projetos/perfil municipal.
- A role web não possui UPDATE, DELETE nem SELECT sobre `audit_events`; a conta administrativa continua privilegiada, portanto backups, restrição de operadores e guarda dos logs permanecem obrigatórios.
- Limpeza periódica recomendada (uma vez ao dia, usando apenas serviço setup): `docker compose --profile setup run --rm setup npm run db:cleanup-auth`. Remove sessões expiradas há mais de sete dias e contadores de login vencidos há mais de dois dias, **sem apagar a auditoria**.

## Instalação pelo Docker
1. Configure `.env` com `POSTGRES_PASSWORD` (admin), `POSTGRES_APP_PASSWORD` (app, distinto e com 24+ caracteres), `SESSION_SECRET` e `APP_ORIGIN`. Para senhas com caracteres especiais, use valores codificados adequadamente na URL.
2. `docker compose up -d db`
3. `docker compose --profile setup run --rm setup npm run db:migrate`
4. `docker compose --profile setup run --rm setup npm run db:provision`
5. Opcional: `docker compose --profile setup run --rm setup npm run db:seed`.
6. Para criar um admin, use o serviço efêmero `setup` com variáveis `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `MUNICIPALITY_NAME` e `MUNICIPALITY_UF`, executando `npm run admin:bootstrap`.
7. `docker compose up -d --build web`

## Riscos e requisitos pendentes
RLS combate erros de escopo, mas um atacante capaz de executar SQL arbitrário com a conta do app pode tentar forjar `app.tenant_id`. Continue usando SQL parametrizado, autorização e verificação de permissões por endpoint.

Limitação distribuída, revogação de sessão e registros básicos de auditoria foram implementados **na branch proposta**, mas precisam de homologação. Ainda faltam MFA, rotação/gestão de sessões em alterações de senha, centralização/tamper-evidence dos registros de auditoria, configuração correta do proxy, TLS/backup/restore homologados e revisão LGPD. Em base existente, projetos com responsável de outro município precisam ser saneados antes da migração. CI aprovada não equivale a penteste profissional nem libera produção.
