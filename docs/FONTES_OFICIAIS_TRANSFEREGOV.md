# AXE Fomento — Fluxo experimental de dados oficiais
Data: 05/11/2026. Integração em ambiente de validação, sem autorização de produção.

## Por que não transformar programas em editais automaticamente?
O novo portal oficial da API de Dados Abertos do Transferegov é
https://api-publica.transferegov.gestao.gov.br/.
O módulo Gestão de Parcerias contém registros de programas públicos; registro
de programa **não comprova** edital publicado, prazo aberto ou elegibilidade do município.

A coleta inicial lê até 25 registros do endpoint
https://api-publica.transferegov.gestao.gov.br/parcerias/programa
e conserva somente ID de origem, título e órgão quando disponíveis.
Não importa valores, prazos, documentos, dados pessoais nem afirma vigência.
A URL armazenada é a do catálogo, não uma URL específica de cada registro.

## Proteções de funcionamento
- Requer login de administrador municipal e proteção de origem da requisição.
- Desabilitado por padrão: habilitar `ENABLE_OFFICIAL_SOURCE_SYNC=yes` apenas
  em ambiente autorizado, após inspecionar OpenAPI vigente, termos de reutilização e amostras reais.
- Sem destinos arbitrários: URL HTTPS fixa para a fonte governamental, sem
  redirecionamentos, limite de 1 MB, timeout de 8 segundos, até 25 entradas
  normalizadas e rejeição de formatos desconhecidos.
- Falhas resultam em status de execução, sem publicar registros parciais no radar.
  Registros já armazenados não são apagados em caso de falha da fonte.
- Deduplicação por município + fonte + identificador externo. Mudanças nas
  informações monitoradas produzem uma nova versão com checksum.
- Mudança de versão retorna estado para revisão pendente.
- Administrador registra decisão e justificativa em histórico independente
  na versão atual; não é possível aprovar versão obsoleta.
- Políticas RLS isolam programas, versões, revisões e execuções por município.
- Nenhum botão de publicação automática para `opportunities`: os registros
  deste módulo continuam como *programas observados*.

## Critérios adicionais antes de uso real
1. Obter resposta real de amostra do endpoint e revisar campos e paginação.
2. Conferir política de acesso, termos de reutilização, limites e conteúdo do dataset.
3. Testar falha de rede, retorno parcial, duplicatas, alteração de versão e
   reconexão em ambiente isolado.
4. Validar processo de checagem do edital individual antes de publicar como
   oportunidade com data e prazo confirmados.
5. Homologação operacional e evidências da issue #13: ainda **NO-GO**.

## Evidências locais de desenvolvimento
- Migração incremental: `sql/007_official_source_pipeline.sql`.
- Parser defensivo: `lib/transferegov-normalize.mjs`.
- Processamento: `lib/source-ingestion.ts`.
- Controle administrativo: `/fontes` e `/fontes/[id]`.
- Testes unitários de formato e integração de revisão/RLS com dados fictícios
  (sem conectar ao Transferegov real durante o CI).
