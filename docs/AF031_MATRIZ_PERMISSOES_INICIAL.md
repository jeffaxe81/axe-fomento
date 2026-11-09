# Matriz de permissões — inventário inicial (AF-031)

**Estado:** inventário parcial baseado no código da branch `main`; não é uma matriz de autorização completa nem um aceite de segurança.

## Evidências confirmadas

| Área | Administrador (`admin`) | Analista (`analyst`) | Evidência / limite |
| --- | --- | --- | --- |
| Identidade da sessão | Papel retornado na sessão autenticada | Papel retornado na sessão autenticada | `lib/auth.ts` define a união de papéis e consulta `auth_session_user`. |
| Município da sessão | Associado a `municipality_id` | Associado a `municipality_id` | `lib/auth.ts`; não aceitar município enviado pelo cliente como identidade. |
| Autenticação | Sessão assinada, cookie HttpOnly e validação no banco | Mesmo mecanismo | `lib/auth.ts`; sessão com expiração de 8 horas. |
| Isolamento de dados | Contexto municipal aplicado por transação | Contexto municipal aplicado por transação | `lib/db.ts` usa `queryForMunicipality`, `app.tenant_id` e transação. |
| Operações privilegiadas no PostgreSQL | Não decorre do papel de usuário | Não decorre do papel de usuário | A aplicação conecta como `fomento_app`; não deve usar credencial administrativa. |
| Bootstrap de contas | Procedimento administrativo/CLI | Não documentado como auto cadastro | README informa cadastro público de administradores desabilitado. |

## Limites que precisam ser verificados antes de declarar a matriz completa

1. Inventariar todas as páginas, Server Actions e rotas `app/api/**`.
2. Para cada operação, registrar método, papel permitido, escopo municipal, validação de entrada e efeito persistido.
3. Confirmar que verificações de papel ocorrem no servidor e não apenas na interface.
4. Testar acessos negados para analista em ações exclusivas de administrador.
5. Testar chamadas sem sessão, sessão revogada, município adulterado e acesso cruzado entre dois municípios.
6. Confirmar que exportações, anexos, relatórios e endpoints administrativos respeitam o mesmo escopo.
7. Manter matriz sincronizada com mudanças de rotas e papéis.

## Regras de segurança

- Negar por padrão quando o papel ou o escopo não puder ser comprovado.
- O município deve vir da sessão autenticada validada no servidor.
- Não confiar em `municipality_id`, `role` ou `user_id` enviados pelo navegador.
- RLS e privilégios do PostgreSQL são camadas adicionais; não substituem autorização na aplicação.
- Não adicionar novos papéis nem ampliar privilégios nesta entrega documental.
- Não considerar CI, inventário ou testes sintéticos como homologação institucional.

## Testes já existentes identificados

- `tests/security/role-grants.test.mjs`: verifica que `fomento_app` não é superuser, não cria banco/roles, não ignora RLS, não herda privilégios e não possui INSERT/DELETE em `public.users`. O teste requer banco isolado (`RUN_TEST_DB_ISOLATION=yes`).
- O pipeline da `main` já executa verificações de isolamento multi-tenant e grants restritos; esta documentação não substitui os testes HTTP/PostgreSQL.

## Próxima etapa desta issue

Completar o inventário de rotas e produzir testes negativos por papel e por município. A issue só deve ser encerrada quando cada permissão estiver ligada a uma rota/ação concreta e a evidência de teste correspondente.
