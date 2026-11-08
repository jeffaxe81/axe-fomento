# AXE Fomento — V1: roteiro de aceite com evidências reais
Base: 08/11/2026 · Status da V1: **6/8 marcos (75%)**, **NÃO autorizada para produção**.

## O que foi confirmado em fontes oficiais
- A nova infraestrutura Transferegov possui módulos de Gestão de Parcerias,
  Transferências Especiais e Discricionárias e Legais.
  https://api-publica.transferegov.gestao.gov.br/
- O governo anunciou, em 28/10/2026, a primeira entrega de endpoints dos **Atos Preparatórios**
  no módulo Discricionárias e Legais:
  https://www.gov.br/transferegov/pt-br/noticias/noticias/2026/outubro/transferegov-disponibiliza-nova-api-de-dados-abertos
- A documentação institucional descreve a entrega gradual de Instrumentos e
  Execução Financeira ao longo de 2027. NÃO presumir endpoint já operacional.
  https://www.gov.br/transferegov/pt-br/comunicados/comunicados-gerais/2026/comunicado-24-2026-cronograma-de-disponibilizacao-da-apis-de-dados-abertos-do-discricionarias-legais

**Limite essencial:** um registro de programa/atos preparatórios ou um contrato OpenAPI
não equivale à comprovação de edital aberto, prazo de inscrição, adequação do
município ou contratação. Os endpoints OpenAPI específicos
`/parcerias/openapi.json` e `/discricionarias/openapi.json` ainda dependem
de verificação no ambiente de homologação; o código não infere que eles
respondem com sucesso por estarem configurados.

## Procedimento V1-07 — Edital e enquadramento
1. Administrador municipal obtém no portal oficial a **publicação individual**
   do edital (não uma lista genérica de programas), identifica a instituição,
   número, data de publicação, data de abertura e fechamento e guarda a URL HTTPS.
2. Comprova que o endereço representa realmente a publicação individual, não
   apenas uma referência institucional. Quando aplicável, salvar versão íntegra
   do documento com SHA-256, sem dados pessoais expostos publicamente.
3. Cadastra observação como `oportunidade_conferida` (flag
   `ENABLE_FUNDING_PIPELINE=yes` somente no ambiente institucional autorizado).
   A classificação automática é apenas **potencialmente aberta, conferir fonte**.
4. **Outro administrador** consulta o documento e registra em
   `/oportunidades/conferidas` o parecer em `ENABLE_NOTICE_REVIEW=yes`.
   O próprio autor não consegue aprovar a observação. São exigidos uma
   justificativa documental e a análise de requisitos municipais.
5. Comprova vigência e regras reais para **pelo menos um caso positivo e um
   negativo**, acrescentando um cenário vencido ou suspenso. Confirmar dados
   do município (código IBGE, população, contrapartida, vedações e documentos).
6. Verifica novo edital/retificação para o mesmo programa. O AXE deve bloquear
   novas candidaturas e encaminhamentos vinculados à versão ultrapassada,
   mas preservar histórico e comprovação do protocolo anterior.
7. Um responsável competente atesta os exemplos, versões, evidências
   e limitações em documento assinado. Caso não haja fonte atual verificável,
   **V1-07 continua reprovado**, mesmo com CI verde.

## Procedimento V1-08 — Piloto e aceite institucional
No servidor-alvo, registrar provas para todos os oito portões:
- OP-01: build, Docker Compose, logs, health e URL de homologação.
- OP-02: HTTPS certificado válido, CSP, headers e proxy de borda.
- OP-03: contas reais de homologação, MFA e isolamento entre dois municípios.
- OP-04: login, radar real, revisão cruzada, projeto, alerta e logout.
- OP-05: backup do alvo, restauração isolada, RPO e RTO.
- OP-06: telemetria, alertas, capacidade e rollback documentado.
- OP-07: ensaios de carga, interrupção, reinício e queda de banco.
- OP-08: LGPD, retenção, autorização do ente, termo de aceite assinado.
As telas `/evolucao` e `/api/pilot/gates` registram declarações;
`/api/pilot/reviews` requer outro administrador. Mesmo oito revisões
favoráveis **não executam deploy** nem substituem autorização formal.

## Exigências objetivas para 100%
- V1-07: pelo menos uma oportunidade com documentos reais auditados e
  resultado municipal positivo/negativo sustentado na fonte primária.
- V1-08: oito portões demonstrados na infraestrutura de destino, responsável,
  evidências, aceite institucional e decisão final documentada.
- Qualquer falha crítica: **NO-GO**. Sem evidências externas, manter 6/8.

## Questões pendentes e contornos
| Bloqueio | Contorno sem inventar dados |
| --- | --- |
| Contrato OpenAPI inacessível ou nova versão | Documentar falha; importar dados aprovados por curadoria e marcar coleta indisponível |
| Programa sem edital publicado | Exibir como referência, nunca como oportunidade aberta |
| Município com dado fiscal incompleto | Classificar elegibilidade como indeterminada |
| Retificação/adiamento de edital | Criar nova observação; bloquear novas candidaturas na anterior |
| Fluxo remoto sem ambiente municipal | Continuar CI isolado, mas não elevar o marco V1-08 |
| Prova cadastrada pelo mesmo gestor | Exigir segunda pessoa, trilha imutável e autorização institucional |


## Refinamento da antecipação — revisão independente na V1-07

O radar `/oportunidades/conferidas` exibe a quantidade de registros **com pendências
documentais** e permite filtrar esses itens. A pré-verificação exige:

- publicação individual e prazo ainda potencialmente válido, conferidos com origem;
- população municipal informada quando o edital utiliza limites populacionais;
- segundo parecer positivo relacionado à **mesma observação** e ao **mesmo documento oficial**;
- revisor identificável e diferente do autor, fundamentação e análise de requisitos;
- data civil válida do parecer, nunca anterior à data da consulta/publicação nem posterior a hoje.

A API de revisão também rejeita pareceres com datas incoerentes, antes de persistir.
Os testes incluem casos de autorrevisão, observação divergente, URL trocada, fundamentação
insuficiente, data inexistente, data futura, edital vencido e impedimento municipal.

**Importante:** `documentaryReadyForExternalAudit=true` só significa que os registros
**declarados pelo município** estão documentados para análise. Não certifica existência,
vigência, crédito, financiamento, elegibilidade definitiva, autorização externa ou
GO de produção. A comprovação V1-07 segue pendente de conferência real com fonte primária.

A listagem do radar tem limite de 200 observações e 200 revisões recentes por município;
este indicador não substitui auditoria do histórico integral quando esses limites forem
excedidos. O ambiente-alvo e a decisão OP-01 a OP-08 continuam regidos pela issue #13.
