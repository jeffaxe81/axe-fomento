# AXE Fomento — recuperação de MFA e rotação de credenciais

> Procedimentos para homologação. Código nesta branch **não está autorizado para produção** sem testes em infraestrutura real e aprovação operacional.

## Troca de senha pelo usuário
Em **Segurança da conta → Alterar senha**, o usuário autenticado informa a senha atual e uma senha nova (12 a 128 caracteres com maiúscula, minúscula, dígito e símbolo). O backend:
1. valida a sessão **completa** (MFA concluído quando habilitado);
2. limita tentativas repetidas;
3. verifica a senha atual na função restrita `auth_change_password`;
4. cria um novo hash BCrypt, **revoga todas as sessões anteriores** e gera uma nova sessão em operação transacional;
5. registra `security.password_change` na trilha de auditoria.

Tokens antigos permanecem inválidos, mesmo que o JWT ainda não tenha expirado. O login posterior exige a senha nova e, quando MFA está habilitado, também o autenticador.

## Recuperação emergencial do MFA — operador
**Não existe rota pública de redefinição de MFA.** O operador precisa validar a identidade por procedimento independente e obter aprovação de outro colaborador antes de executar a operação.

1. Abra e registre um ticket interno com ID do município, usuário-alvo, justificativa e provas de validação de identidade, de acordo com a LGPD.
2. Exija duas pessoas distintas — operador e aprovador. O script exige identificadores distintos, mas **não comprova automaticamente a identidade dessas pessoas**: essa validação continua sob responsabilidade operacional.
3. Faça um backup verificado antes de efetuar a recuperação, conforme política da organização.
4. Acesse apenas o serviço temporário de administração (perfil `setup`), nunca o container web. Configure as variáveis:
   - `MFA_RESET_USER_EMAIL`: e-mail institucional confirmado;
   - `MFA_RESET_MUNICIPALITY_ID`: UUID do município correto;
   - `MFA_RESET_TICKET`: ID do ticket (5–80 caracteres alfanuméricos, hífen, sublinhado ou ponto);
   - `MFA_RESET_REASON`: justificativa com pelo menos 12 caracteres;
   - `MFA_RESET_OPERATOR` e `MFA_RESET_APPROVER`: identificadores distintos;
   - `MFA_RESET_CONFIRM=RESET_MFA_REVOKE_ALL_SESSIONS`.
5. Execute `npm run admin:reset-mfa` **somente com `DATABASE_ADMIN_URL`** configurada. Na configuração Docker, forneça as variáveis `MFA_RESET_*` à execução única de `docker compose --profile setup run --rm ... setup npm run admin:reset-mfa`, sem armazená-las no repositório.
6. A transação verifica a conta/município, zera os campos MFA, **revoga todas as sessões** e registra `security.mfa_reset`, incluindo ticket, motivo e identidades declaradas na tabela `audit_events`. Não imprime senhas nem segredos no terminal.
7. A pessoa deve efetuar novo login com sua senha e configurar novamente o MFA. Documente aprovação, hora, operador, evidência e novo cadastro TOTP no ticket; restrinja o acesso ao registro de recuperação.

A automação não deve ser exposta em endpoint HTTP. Revise o ticket depois da operação e considere redefinir também a senha em casos de suspeita de comprometimento.

## Validação e critérios pendentes
- [x] Testes em CI de senha incorreta, senha fraca/reutilizada, troca válida, invalidação dos cookies, auditoria e execução de reset autorizada/não autorizada.
- [ ] Teste operacional em servidor de homologação com duas pessoas reais aprovando.
- [ ] Definir obrigatoriedade de MFA para administradores **após** validar recuperação.
- [ ] Evidência de armazenamento externo/imutável de logs e backups; RPO/RTO.
- [ ] Revisar LGPD e retenção de e-mails, tickets e auditorias.

## Atualização segura do banco e histórico de migrações
A partir deste ciclo, `db:migrate` mantém a tabela `public.schema_migrations`, com versão, data e hash SHA-256 dos scripts já aplicados. Rodar `npm run db:migrate` novamente pula versões concluídas e **interrompe** a implantação se o SQL histórico tiver sido alterado. O CI testa duas execuções sucessivas.

**Instalação nova:** use apenas `npm run db:migrate` seguido de `npm run db:provision`, sempre com `DATABASE_ADMIN_URL` fornecida ao serviço `setup`.

**Base legada anterior ao controle de versões:** o migrador recusará atualizar automaticamente uma base com tabelas existentes, mas sem `schema_migrations`. Faça backup e valide a versão real aplicada, privilégios e integridade das tabelas. Em uma execução única no serviço `setup`, o operador pode registrar um baseline após revisão humana:

```sh
# EXEMPLO para banco comprovadamente atualizado até SQL 004 (não 005)
MIGRATION_BASELINE_THROUGH=4 \\
MIGRATION_BASELINE_CONFIRM=I_VERIFIED_LEGACY_SCHEMA \\
  npm run db:baseline
npm run db:migrate
npm run db:provision
```

**Atenção:** o baseline faz verificações de estrutura e funções, não comprova a equivalência integral de políticas, constraints e dados. Faça a revisão e uma restauração de ensaio antes de usar em banco existente. Não escolha um número de versão superior ao realmente aplicado. Nunca execute com credencial `fomento_app` ou enquanto outra implantação efetua migrações.
