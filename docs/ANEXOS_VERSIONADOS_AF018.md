# AXE Fomento — AF-018: anexos privados e versionados

05/11/2026. Entrega de desenvolvimento, **NO-GO para produção**.

## Comportamento

A ficha do projeto -> **Checklist documental** apresenta cada documento acompanhado
do histórico de arquivos. O usuário autenticado da prefeitura pode enviar PDF, PNG ou
JPEG de até **2 MiB** com justificativa de 10 a 500 caracteres. O arquivo é recebido
via multipart com leitura limitada, tipo inferido por assinatura básica e validado
contra o MIME declarado. Ao fazer upload, o sistema cria uma nova versão (1–20)
sem sobrescrever versões antigas. O arquivo não muda automaticamente o status
do checklist, que continua dependendo do registro humano de evidência.

Download disponível para contas autenticadas da mesma prefeitura. Arquivos são
entregues como `attachment`, com `no-store`, `nosniff` e CSP de isolamento.
Não existe diretório público de uploads ou URL de arquivo aberta.

## Controles criptográficos e PostgreSQL

- Nova migração `012_document_versions.sql`, adicionada depois das onze anteriores.
- AES-256-GCM por arquivo com nonce aleatório de 96 bits e etiqueta de autenticação.
  AAD vincula município, projeto e documento. SHA-256 verifica integridade adicional.
- Chave separada `ATTACHMENT_ENCRYPTION_KEY`: base64 de 32 bytes, nunca armazenada
  no PostgreSQL, nunca incluída no download e nunca exposta ao navegador.
- Modelo guarda metadados e ciphertext `bytea`, inclusive o número da versão,
  autoria e justificativa.
- Transação única atualiza contador do documento (com bloqueio concorrente no
  `UPDATE`) e insere a versão. A versão anterior permanece intacta.
- `FORCE ROW LEVEL SECURITY` restringe todos os registros ao município autenticado;
  a role web possui `SELECT,INSERT` nas versões, sem `UPDATE,DELETE`.
- Limite por item de 20 versões, sem quota global por município nesta etapa.

## Ativação controlada

O recurso usa `ENABLE_DOCUMENT_UPLOADS=no` por padrão, inclusive em Docker.
No CI exclusivamente, a flag é `yes` com chave de teste descartável. Falta de
chave válida bloqueia escrita e leitura de anexos. **Não habilitar em produção
antes da revisão do malware scanning, quota, retenção, políticas LGPD, backups,
recuperação da chave e desempenho de arquivos**.

O teste de assinatura básica não substitui varredura antimalware nem parser
seguro de PDF/imagem. Assim, a funcionalidade está codificada e exercitada no
ambiente isolado, não homologada para carga real.

## Testes

- `tests/private-attachments.test.mjs`: formatos, chave inválida, adulteração,
  contexto da prefeitura e roundtrip.
- `tests/integration/document-versions.test.mjs`: usuários municipais,
  upload válido/inválido, concorrência, versões, acesso cruzado, download,
  criptografia, corrupção detectada, RLS e permissões de banco.
- CI integra tipagem, migrações/checksums, build, permissões, Docker e restore.

Próximas exigências: antivírus/quarentena verificável, upload assíncrono para
objetos privados, cotas e expurgo regulado e monitoramento/alertas. Exige aceite
da área operacional antes de ativar.
