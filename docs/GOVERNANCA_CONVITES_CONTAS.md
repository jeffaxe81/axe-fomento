# AXE Fomento — AF-015 e AF-016: governança municipal

Data: 05/11/2026. Implementação destinada a testes/homologação, **sem autorização de produção**.

## Convites institucionais (AF-015)

- Administrador autenticado acessa **Usuários municipais**, informa e-mail e perfil `analyst` ou `admin`.
- O servidor gera um código aleatório criptograficamente seguro de 256 bits em base64url.
  No PostgreSQL é armazenado apenas o hash SHA-256. A validade é **48 horas**.
- Um convite anterior ainda não consumido para o mesmo endereço é revogado na reemissão.
- O código é exibido apenas na resposta da emissão e deve ser entregue **manualmente**
  por canal confiável. Não há envio automático por e-mail nesta entrega.
- A pessoa convidada abre **/convite**, digita código, nome e senha robusta. O
  município, e-mail e função vêm exclusivamente do convite no servidor.
- O uso do código é único e a aceitação é transacional, mesmo com requisições concorrentes.
  O aceite não autentica automaticamente: a pessoa deve fazer login com a própria senha.
- Senha de 12 a 128 caracteres, com maiúscula, minúscula, número e símbolo.
- O código não é colocado na URL, no histórico administrativo ou em texto simples no banco.

## Contas municipais (AF-016)

- Somente administradores municipais podem desativar e reativar contas do próprio município.
- A desativação altera a conta e revoga todas as sessões existentes **na mesma transação**.
  A função não permite desativar a própria conta autenticada ou o último admin ativo.
- A reativação não reabre sessões antigas; requer novo login.
- Alterações e emissão/aceite de convites geram eventos de auditoria vinculados ao município.
- Segurança reforçada por funções `SECURITY DEFINER` que conferem sessão atual no banco.
  A aplicação não possui GRANT direto à tabela de convites nem ao hash de senhas.

## Validação

- Migração incremental: `sql/009_user_governance.sql`, sem editar migrações antigas.
- Endpoints: `POST /api/admin/invitations`, `POST /api/auth/invite/accept`,
  `PATCH /api/admin/users/status`.
- Teste: `tests/integration/municipal-user-governance.test.mjs` utiliza duas prefeituras,
  papel analista, ataques por origem, convite expirado, código reutilizado, corrida de
  aceitações, token revogado, conta desativada, sessões antigas e permissões SQL.
- A suíte completa inclui build, testes, imagens Docker e restauração criptografada.

## Pendências para a produção

1. Definir canal seguro e processo institucional de entrega dos códigos.
2. Revisar segurança e autenticação forte para novos administradores.
3. Validar acessibilidade, desempenho, regras institucionais e suporte.
4. Homologar no ambiente definitivo conforme a issue #13, sem alterar a decisão **NO-GO**.
