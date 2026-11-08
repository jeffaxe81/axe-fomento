# V1 — Contratos oficiais Transferegov e dependências de homologação

## Fatos confirmados pelo portal oficial em 07/11/2026
- O Transferegov anunciou em 28/10/2026 a disponibilização inicial da nova API de
  **Transferências Discricionárias e Legais**, iniciando por **Atos Preparatórios**.
  Publicação: https://www.gov.br/transferegov/pt-br/noticias/noticias/2026/outubro/transferegov-disponibiliza-nova-api-de-dados-abertos
- O portal de APIs apresenta os módulos Gestão de Parcerias e Discricionárias e Legais.
  https://api-publica.transferegov.gestao.gov.br/
- Documentação:
  https://api-publica.transferegov.gestao.gov.br/parcerias/docs
  https://api-publica.transferegov.gestao.gov.br/discricionarias/docs
- Estes anúncios **não provam** que o endpoint possua todos os campos de edital,
  inscrição, prazo, montante ou elegibilidade; APIs de dados abertos não substituem
  APIs de submissão privada.

## Incremento técnico sem alegação de homologação
- `lib/transferegov-contract.mjs`: somente dois endpoints OpenAPI fixos com HTTPS,
  GET sem redirecionamento, timeout, tamanho limitado, JSON validado, SHA-256 e
  inventário de rotas GET; nunca publica editais.
- `source_contract_checks`: evidência versionada por execução, data, município, ator,
  documentação, digest e quantidade de endpoints; RLS FORCE, privilégios de leitura/gravação.
- `/api/sources/contracts`: GET privado e POST somente para administrador e opt-in
  `ENABLE_OFFICIAL_CONTRACT_CHECK=yes`.
- `/fontes`: painel do histórico de contratos por município. Check desligado por padrão.
- CI: fixtures de contratos simulados, papéis, isolamento, migração 037 e guardrails.

## Próximo bloqueio para V1-07
1. Executar a verificação de contrato no ambiente institucional de homologação, com
   registro de data/digest e autorização de acesso à API.
2. Mapear os campos documentados de edital/chamamento e vigência em **recurso individual**.
3. Consultar amostras positivas e negativas diretamente na fonte primária e comprovar
   encerramento e ausência de prazo com status conservador.
4. Verificar com equipe municipal as exigências por edital e código IBGE; a ferramenta
   não pode aprovar enquadramento jurídico autonomamente.

## Próximo bloqueio para V1-08
Homologação com ente público parceiro e oito gates OP-01 a OP-08 com logs, certificado HTTPS,
backup restore em ambiente-alvo, treinamento, LGPD, assinaturas e aceite.
**Sem teste externo e aceite, produto permanece NO-GO.**

## Indicador
**V1 = 6/8 (75%)**, contrato inspecionável é incremento de segurança dentro do V1-07,
mas não constitui o aceite desse marco. **Geral = 11/24 (46%)**. Não marcar
V1-07/V1-08 como concluídos sem as evidências externas.
