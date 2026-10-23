# AXE Fomento — proteções no PostgreSQL

## Implementado na branch em validação
- RLS em `municipalities`, `users` e `projects`, com bloqueio por padrão quando o contexto municipal não existe.
- `fomento_app`: conta sem SUPERUSER/BYPASSRLS e sem acesso direto aos hashes de senha.
- Cada consulta a dados municipais usa transação com `app.tenant_id` derivado da sessão autenticada. O contexto desaparece no COMMIT/ROLLBACK, impedindo vazamento entre conexões reutilizadas.
- Autenticação via funções `SECURITY DEFINER` e concessão de execução apenas à role da aplicação.
- Chave estrangeira composta impede associar responsáveis de outra prefeitura aos projetos.
- CI testa isolamento de duas prefeituras diretamente no PostgreSQL, além dos testes HTTP anteriores.

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

Faltam rate limiting distribuído, MFA, revogação de sessão, auditoria imutável, TLS/backup/restore homologados e revisão LGPD. Em base existente, projetos com responsável de outro município precisam ser saneados antes da migração. CI aprovada não equivale a penteste profissional nem libera produção.
