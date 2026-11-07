# AXE Fomento — execução e aceite da implantação

**Estado inicial: NO-GO.** Código AF-001 a AF-050 testado no CI não equivale a serviço validado.
Este roteiro complementa `docs/HOMOLOGACAO_OPERACIONAL.md` e a issue #13.
Não execute comandos destrutivos em banco real. Os exemplos não contêm credenciais.

## Pré-requisitos e autoridade

O responsável operacional deve preencher: servidor/endereço de destino, sistema operacional,
domínio público, equipe e data de implantação, gestor do aceite, política de retenção,
RPO/RTO **definidos pelo órgão** e janelas de manutenção. Não inventar datas ou metas.
O usuário responsável deve aprovar a ativação das flags por módulo; valores iniciais são `no`.
Faça revisão independente da configuração de rede, LGPD, logs e backups.

Os três controles de segurança são distintos: `SESSION_SECRET` >=32 caracteres,
`MFA_ENCRYPTION_KEY`, `ATTACHMENT_ENCRYPTION_KEY` e `BACKUP_ENCRYPTION_KEY` com
32 bytes aleatórios em base64 cada, e `POSTGRES_PASSWORD`/`POSTGRES_APP_PASSWORD`
diferentes com 24+ caracteres URL-safe; PostgreSQL no Compose interpola senhas em URLs.
Recomendação para senhas do banco: `openssl rand -hex 32`.
Recomendação para chaves de 32 bytes: `openssl rand -base64 32`.
Segredos devem ficar fora do repositório, em cofre seguro, com backup das chaves separado dos dumps.

## Etapa 0 — checagens sem implantação

1. Use um ambiente **de homologação** com URL HTTPS e certificados válidos.
2. Configure `.env` via cofre, permissões 0600, não comite ou imprima segredos.
3. `node scripts/ops-preflight.mjs static` — valida artefatos e flags no Compose.
4. `node --env-file=.env scripts/ops-preflight.mjs env` — valida configurações em memória, sem exibir valores.
5. `docker compose config --quiet` — valida interpolação sintática da configuração.
6. `docker compose config --services` — confira os serviços; **não** publique `docker compose config` completo, pois pode incluir segredos.
7. `git rev-parse HEAD` — registre o SHA exato a implantar.

**Critério:** se uma verificação falhar, corrija sem avançar. `static` e `env` não aprovam OP-01..08.

## Etapa 1 — banco e aplicação (sem interrupção de produção preexistente)

Na primeira instalação em ambiente vazio e com janela aprovada:

```sh
docker compose up -d db
docker compose --profile setup run --rm setup npm run db:migrate
docker compose --profile setup run --rm setup npm run db:provision
# bootstrap institucional somente em ambiente autorizado: veja README.md
docker compose up -d --build web
docker compose ps
```

Revisar logs usando `docker compose logs --tail=100 web` e
`docker compose logs --tail=100 db`, sem anexar segredos ou dados pessoais ao ticket.
A aplicação mantém só a porta `127.0.0.1:3000` publicada; o proxy deve ser o único ponto público.
O serviço HTTP executa como usuário `node`, sem privilégios adicionais e com healthcheck periódico.
Nunca execute migrações administrativas com a role de web ou exponha
`DATABASE_ADMIN_URL` ao container de aplicação.

**Bases legadas:** migrações são incrementais, com ledger e checksum. Teste restore isolado e
valide alterações antes de qualquer atualização. Não faça downgrade automático de esquema.

## Etapa 2 — HTTPS e teste remoto (somente leitura)

Configure Nginx/terminação TLS em servidor de homologação; substitua domínio e arquivos
de certificado da amostra `deploy/nginx-fomento.conf.example`. Confirme DNS, CA,
TLS 1.2/1.3, HSTS, tamanho máximo de 3 MiB e acesso externo apenas às portas 80/443.
Os uploads privados do app permitem até 2 MiB por arquivo.

Com `APP_ORIGIN=https://dominio.validado` exportado pelo operador, execute:

```sh
node scripts/ops-preflight.mjs remote
```

A sondagem verifica HTTPS, /api/health, JSON e cabeçalhos de segurança, mas NÃO
testa login, CSRF, MFA, isolamento, URL pública final, confiança do proxy,
conteúdo malicioso ou disponibilidade real de editais. Guarde um relatório de evidências
sem cookies, tokens, URLs internas com credenciais ou dados reais de munícipes.

## Etapa 3 — fluxos por pessoas autorizadas

- OP-03: verificar role web sem permissão administrativa; administrar dois municípios
  *fictícios* de teste e tentar acesso cruzado em UI, API e anexos; registrar 403/404.
- OP-04: login, senha forte, sessão, logout, convites, MFA, revogação e recuperação
  com duas pessoas, perfil, radar, projetos, cadastro documental e avaliador.
- OP-05: backup criptografado real no host, cópia **externa**, retenção definida,
  teste de verificação e restauração em banco descartável em infraestrutura separada;
  medir tempo efetivo para RPO/RTO.
- OP-06: log centralizado, coleta e retenção aprovadas, alerta de indisponibilidade,
  monitoramento de disco e certificados, contato de plantão e procedimento de rollback.
- OP-07: ensaio de reinício, indisponibilidade controlada **em homologação**,
  medição de comportamento da aplicação e carga não destrutiva.
- OP-08: parecer LGPD, política de privacidade/retencão, tratamento de anexos,
  aceite do responsável técnico e do representante designado.
- Ative flags seletivamente somente após aprovação dos respectivos módulos.
  Um registro de financiamento não significa aprovação por órgão oficial.

## Backup e retorno seguro

A rotina de backup `docker compose --profile operations run --rm operations`
cria dump criptografado em volume próprio. Ela **não é um agendamento automático**.
O operador deve instalar agendamento em servidor, definir cópia fora do host,
retenção e alertas e verificar restore a partir de cópia externa. Nunca copie o
volume para dentro do GitHub.

Se houver problema, isole tráfego de ingresso e revogue ativação de flags afetadas.
Rollback de imagem é condicionado à compatibilidade do esquema com a versão anterior.
Migrações de banco são `forward-only`, não faça restore em produção como rollback
de rotina sem autorização e ensaio de recuperação. Meça indisponibilidade e anexe evidência.

## Matriz e decisão

Preencha os oito portões e links de evidência em `docs/HOMOLOGACAO_OPERACIONAL.md`
(ou em registro controlado da operação). Para cada um, registre
responsável, timestamp, servidor-alvo, SHA, comando/resultado, log sanitizado,
teste de reversão e decisão. Um caso `BLOQUEADO` ou `SEM EVIDÊNCIA` torna
a decisão final **NO-GO**.

Aprovação para produção depende do responsável e não pode ser inferida por CI.
Fechar a issue #13 apenas após todos OP-01..08 aprovados no alvo, sem flags
experimentais ativas antes do aceite.
