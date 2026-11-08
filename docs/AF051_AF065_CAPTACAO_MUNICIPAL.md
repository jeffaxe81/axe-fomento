# AXE Fomento — AF-051 a AF-065 · Captação municipal assistida
Data-base de desenvolvimento: 07/11/2026. Branch `feat/af051-af065-financing-outcomes`,
[PR #26](https://github.com/jeffaxe81/axe-fomento/pull/26), baseado na preparação operacional do PR #25.

## Diretriz de produto
Uma prefeitura precisa descobrir oportunidades **com fonte verdadeira**, validar as regras vigentes
e o enquadramento municipal, organizar documentos e autorizações, formalizar a candidatura no
portal oficial e acompanhar decisões, liberações e resultados. O AXE dá suporte e histórico
do processo, mas não substitui o parecer legal/financeiro nem é agente de concessão de crédito.

## Entregas codificadas e limites de integração

| ID | Entrega | Implantação no código | Limite que exige homologação |
| --- | --- | --- | --- |
| AF-051 | Consulta Transferegov | API `POST /api/funding/sources`, integra `fetchOfficialPrograms`; persistência de programas observados em RLS | Contrato da API, volume, licença, paginação real e liberação `ENABLE_OFFICIAL_SOURCE_SYNC` |
| AF-052 | Atualização de referências BNDES | Importação de catálogo versionado de 37 páginas BNDES Cidades; nova observação por impressão digital | Dados não são linhas bancárias confirmadas. Condições e disponibilidade precisam de revisão no portal |
| AF-053 | Consulta CAPAG | Referência do portal Tesouro no catálogo; campo CAPAG já existente no perfil municipal | Não baixa/consulta automaticamente a nota individual por município; checagem oficial do ano-base é humana |
| AF-054 | Vigência e condições | Classificação em observação, expiração de 30 dias da conferência, prazos, termos, evidência e fonte HTTPS restrita | Confirmação ainda é uma declaração humana |
| AF-055 | Alertas | Assinaturas por usuário/modalidade e janelas de 7/30/90 dias, visualização na plataforma | Sem notificação push/e-mail nem serviço agendado no servidor |
| AF-056 | Elegibilidade financeira | Sinais de CAPAG, porte populacional, garantia, documentos por linha, pendência de revisão | Nenhuma nota garante crédito ou garantia |
| AF-057 | Comparativo | Seleção de até três referências com status, taxa anual informada, prazo e origem | Taxas ausentes não são inventadas |
| AF-058 | Simulação | API de prévia reproduzível (Price, taxa nominal, carência informada), sem persistência | Não inclui tarifas, impostos, indexação, CET ou oferta vinculante |
| AF-059 | Conferência documental | Confronto de títulos exigidos no registro da linha com checklist/anexos versionados do projeto | Não interpreta um edital automaticamente |
| AF-060 | Dossiê de candidatura | Geração PDF com fonte, projeto, histórico de ações e SHA-256 | Dossiê interno, não documento oficial de protocolo |
| AF-061 | Encaminhamento assistido | Instruções no fluxo e link HTTPS de domínio oficial; registro append-only de encaminhamento | Nenhum envio automático ou uso de credenciais de terceiros |
| AF-062 | Protocolo | Registro sequencial, status e referência de protocolo externo, com histórico | Sincronização automática apenas se existir API oficial disponível/autorizada; NÃO implementada |
| AF-063 | Diligências | Eventos de diligência com data e alertas de vencimento na ficha | Prazo é informado pela equipe e deve ser conferido no órgão |
| AF-064 | Aprovações e liberações | Eventos com valor positivo, URL institucional e histórico imutável | Valores declarados não são reconciliação com contrato ou conta bancária |
| AF-065 | Indicadores | Dashboard com valores de aprovação/desembolso declarados e CSV privado por município | Não constituem comprovação de transferência de recursos |

**Advertência:** alguns dos 15 itens possuem um **núcleo implementado** com revisão humana,
mas não encerram o escopo de **integração em produção**. É incorreto declarar AF-051, 052, 053,
062 e 064 homologados sem amostras reais, autorização de fonte e testes no servidor-alvo.

## Estrutura
- `sql/036_funding_pipeline.sql`: quatro tabelas de dados municipais, FORCE RLS e FKs compostas.
- `lib/funding-pipeline.mjs`: validação da fonte, prazo, pontuação, simulação, gaps e métricas.
- `app/api/funding/observations`: snapshots com origem, estado e versão documental.
- `app/api/funding/sources`: coleta controlada e catálogos referenciais.
- `app/api/funding/cases`, `events`, `alerts`: ciclo de vida e auditoria da candidatura.
- `app/api/funding/simulate`: prévia financeira hipotética.
- `app/api/funding/dossier/[caseId]`: PDF interno autorizado.
- `app/api/funding/reports`: números internos em JSON/CSV, sem confirmação bancária.
- `/captacao`, `/captacao/[id]`: consulta, jornada e responsável pelo projeto.

## Segurança e operação
- Todas as escritas exigem sessão assinada, validação de origem, Zod estrito, papel e RLS.
- `ENABLE_FUNDING_PIPELINE=no` por padrão: CI pode ligar em PostgreSQL descartável.
- Programas Transferegov registrados como `programa_observado`: **não são editais abertos**.
- Números de protocolo e valores não são recuperados de portais privativos sem API/autorização.
- PDF e CSV são privados para sessão autenticada.
- Backups, autenticação, HTTPS, logs e proteção de dados dependem dos portões OP-01 a OP-08.
- Não fazer merge para `main` nem deploy automático enquanto a issue #13 estiver aberta.

## Testes
- `tests/funding-pipeline.test.mjs`: regras puras, vínculos, cenários e indicadores.
- `tests/integration/funding-pipeline.test.mjs`: HTTP autenticado, dois municípios,
  CSRF, escritas imutáveis, PDF, simulação, fontes, alertas e RLS em PostgreSQL isolado.
- CI adicional verifica migrações 036 repetíveis, tipagem, build, container, backup e restore.
- O CI não efetua chamadas externas ao BNDES, Transferegov ou Tesouro.

## Critérios ainda exigidos para resultado real de captação
1. Homologar dados abertos do Transferegov com amostras e contratos oficiais.
2. Ligar as condições atualizadas de BNDES ao projeto, sem inferir taxa, garantia ou vigência.
3. Consultar automaticamente a publicação CAPAG correspondente ao código IBGE e ano-base, se o formato e acesso oficiais permitirem.
4. Sincronizar estados de protocolo quando houver contrato API com escopo autorizado.
5. Verificar aprovação/repasses por fonte com referência e reconciliação independente.
6. Conduzir piloto com município parceiro, prova de ponta a ponta, aceite e comprovação do valor efetivamente captado.

**A implementação no Git não equivale à comprovação de crédito obtido.**
