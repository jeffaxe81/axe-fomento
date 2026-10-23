# AXE Fomento — plano operacional de segurança (4 semanas antecipadas)

> **Estado:** código em PR Draft; não equivale a homologação em produção.
> Senhas, nomes de host e domínios deste documento são exemplos. Nunca copie segredos para Git.

## Entrega 1 — sessões e MFA (código)
- Login com MFA TOTP opcional, habilitado individualmente em **Segurança da conta**.
- Segredos TOTP cifrados em repouso com AES-256-GCM e chave exclusiva `MFA_ENCRYPTION_KEY` (32 bytes em base64).
- Após senha válida, um usuário com MFA ativo recebe somente cookie de desafio de 5 minutos; **não** recebe sessão autorizada até confirmar o código.
- Janela de códigos de 30 segundos ±1 período, verificação com comparação em tempo constante e proteção de reutilização no PostgreSQL.
- Ativação do MFA revoga outras sessões do usuário; a tela permite encerrar sessões remotas.
- Registros de senha não são gravados no log e chaves MFA não são visíveis pela role limitada.
- **Limitações:** MFA é opt-in nesta etapa (não é obrigatório para administradores ainda); não há códigos de recuperação, autoatendimento de reset ou rotação automatizada da chave MFA. Não ativar compulsoriamente sem procedimento de suporte.

## Entrega 2 — privacidade e controle de acesso
- Isolamento RLS de municípios, usuários e projetos, com login/identidade protegidos por funções SQL restritas.
- Auditoria de autoria das mudanças (projetos e perfil municipal), registrada por triggers. A conta web não pode editar a tabela de auditoria.
- Rate limit distribuído por conta e, se ativado e configurado corretamente, por IP recebido do proxy.
- Cabeçalhos de segurança: anti-framing, MIME nosniff, COOP/CORP, HSTS (efetivo em HTTPS) e CSP parcial.
- **Limitações:** RLS por `app.tenant_id` não dispensa consultas parametrizadas; conta proprietária do banco segue privilegiada; auditoria exige retenção externa/tamper-evidence para proteção contra administrador hostil.

## Entrega 3 — backup, prova de integridade e restauração de ensaio
- Gere duas chaves **distintas**:
  ```sh
  openssl rand -base64 32   # MFA_ENCRYPTION_KEY
  openssl rand -base64 32   # BACKUP_ENCRYPTION_KEY
  ```
- Configure `.env` e implante primeiro as migrações e grants:
  ```sh
  docker compose up -d db
  docker compose --profile setup run --rm setup npm run db:migrate
  docker compose --profile setup run --rm setup npm run db:provision
  docker compose up -d --build web
  ```
- Crie backup **criptografado em trânsito de processo e repouso**, sem dump SQL intermediário em disco:
  ```sh
  docker compose --profile operations run --rm operations
  ```
- O volume `backup-data` contém `.dump.enc` e `.dump.enc.json` (manifesto SHA-256 e tag AES-GCM).
  Ambos os arquivos devem ser copiados a armazenamento externo, isolado e com controle de retenção.
- Verifique o arquivo no container de operações:
  ```sh
  BACKUP_FILE=/backups/axe-fomento-EXEMPLO.dump.enc \
    docker compose --profile operations run --rm operations node scripts/verify-backup.mjs
  ```
- Para restauração de **ensaio, nunca no banco original**, crie banco vazio com nome iniciado em `fomento_restore_`, defina `RESTORE_TARGET_URL` apontando especificamente para esse banco e execute:
  ```sh
  BACKUP_FILE=/backups/axe-fomento-EXEMPLO.dump.enc \
  RESTORE_TARGET_URL='postgresql://fomento:SENHA_URL_ENCODED@db:5432/fomento_restore_teste' \
  RESTORE_CONFIRMATION=RESTORE_DISPOSABLE_DATABASE \
    docker compose --profile operations run --rm operations node scripts/restore-test-db.mjs
  ```
- A restauração valida GCM/SHA-256 **antes** de usar `pg_restore`, rejeita banco-alvo igual ao original e restringe o nome-alvo ao prefixo `fomento_restore_`. A restauração usa transação única.
- Em caso de erro, mantenha o backup e descarte apenas o banco de ensaio. **Não use a rotina de teste para recuperar dados de produção sem revisão humana**.
- CI testa a restauração em PostgreSQL 17 descartável. O resultado não mede RPO/RTO nem substitui um ensaio em infraestrutura real.

## Entrega 4 — HTTPS, CI e checklist de GO
- Use Nginx como ponto de terminação TLS com certificados reais e redirecionamento HTTP → HTTPS.
- Configure `APP_ORIGIN=https://fomento.seu-dominio.tld`. Coloque a porta 3000 atrás do proxy, não aberta publicamente.
- Só configure `TRUST_PROXY_IP=true` quando o Nginx for o único caminho público e substituir `X-Real-IP`. Não repasse cabeçalhos de origem arbitrária do navegador.
- CI verifica testes de unidade, tipos, build Next, isolamento multi-tenant HTTP/DB, login/MFA, revogação, auditoria, imagem web, imagem de operações, dump cifrado, verificação e ensaio de restore, além de auditoria de vulnerabilidades críticas de dependências.
- Verifique certificados, sessões, rollback de migração, isolamento tenant e backup externo **no servidor de homologação**.

## Plano de testes e pendências de GO
- [ ] Execução de testes de instalação Docker Compose em servidor e Nginx HTTPS real.
- [ ] Prova de recuperação de backup armazenado externamente, com tempo de RPO/RTO medido.
- [ ] Plano de recuperação de MFA e rotação de chaves sem perda de acesso.
- [ ] MFA obrigatório para papéis administrativos após validação de suporte e recuperação.
- [ ] Evidência de logs imutáveis/centralizados e revisão LGPD.
- [ ] Auditoria independente de dependências, penteste e autorização formal de produção.

Não desative MFA editando diretamente a base durante incidente sem procedimento formal e registro de auditoria. Em perda da chave MFA, os segredos existentes não podem ser decifrados; armazenar a chave em cofre e testar a recuperação dela é obrigatório.
