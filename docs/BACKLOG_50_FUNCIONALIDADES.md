# AXE Fomento — escopo estimado de 50 funcionalidades

05/11/2026 · Base técnica `db1cf695` do [PR #1](https://github.com/jeffaxe81/axe-fomento/pull/1).

O AXE Fomento atende equipes municipais na descoberta de oportunidades, preparação de candidaturas e acompanhamento da captação. A ampliação segue quatro entregas de produto. A V1.1 estende a fundação de desenvolvimento com a carteira e o radar. A V2 reúne preparação, gestão e IA. A V3 amplia a rede. A V4 avalia a prontidão de ideias e projetos documentados.

As 50 funcionalidades abaixo são entregas propostas para esse escopo. As issues #14 a #23 fornecem dependências quando aplicável. O conector do Transferegov e os componentes da V2 à V4 detalham entregas dos épicos #4 e #6. O primeiro incremento prioriza AF-001 a AF-004, que têm valor para a equipe municipal e usam a estrutura PostgreSQL existente.

## Estimativa de esforço

Um dia-pessoa (DP) corresponde a um dia de trabalho de uma pessoa. As faixas incluem implementação, testes aplicáveis, revisão e documentação da entrega. O total é a soma das faixas, com trabalho paralelizável e dependências indicadas por item. Prazos de autorização de fonte, contratação e homologação municipal são apurados à parte. As faixas de conectores dependem de amostras válidas, condições de uso e disponibilidade da fonte.

| Entrega | Escopo | Funcionalidades | Esforço (DP) |
| --- | --- | ---: | ---: |
| V1.1 | Carteira municipal, radar, dados de origem e elegibilidade inicial | 16 | 57–95 |
| V2 | Preparação de candidaturas, documentação, simulações e IA assistiva | 17 | 80–133 |
| V3 | Rede nacional e internacional, consórcios e indicadores | 8 | 39–68 |
| V4 | Avaliação preliminar de maturidade e viabilidade de projetos | 9 | 39–65 |
| **Total** | | **50** | **215–361** |

## V1.1 — Carteira municipal, radar, dados de origem e elegibilidade inicial

| ID | Frente | Funcionalidade | DP | Dependência | Critério de aceite |
| --- | --- | --- | ---: | --- | --- |
| AF-001 | Carteira municipal | Busca por título de projeto | 1–2 | Base V1 | Um termo encontra títulos do próprio município sem diferenciar maiúsculas e minúsculas. Caracteres como % e _ são tratados literalmente. |
| AF-002 | Carteira municipal | Filtro de projetos por situação | 1–2 | Base V1 | A seleção exibe apenas a situação solicitada e funciona em conjunto com a busca. |
| AF-003 | Carteira municipal | Paginação do portfólio | 2–3 | AF-001, AF-002 | As páginas exibem até 25 projetos, em ordem estável por criação e ID, e preservam os filtros na navegação. |
| AF-004 | Carteira municipal | Ficha individual do projeto | 2–3 | Base V1 | Abre por link com título, situação, responsável, oportunidade e datas. Uma prefeitura não consegue abrir fichas de outra. |
| AF-005 | Radar | Comparação de oportunidades | 3–5 | Base V1 | Compara até três oportunidades por órgão, valor, prazo, área e abrangência, com campos ausentes e exemplos identificados. |
| AF-006 | Radar | Agenda de prazos do radar | 2–4 | #15 | Lista em ordem cronológica prazos cadastrados nos próximos 7, 30 ou 90 dias e identifica oportunidades fictícias. |
| AF-007 | Radar | Favoritos de oportunidades por usuário | 3–5 | Base V1 | O usuário marca e desmarca oportunidades e recupera sua lista em outra sessão com a mesma conta. |
| AF-008 | Radar | Buscas salvas do radar | 3–5 | #14 | Uma consulta com filtros pode ser nomeada, editada e reaberta pelo próprio usuário. |
| AF-009 | Fontes oficiais | Conector inicial do Transferegov | 8–13 | #4, acesso à fonte | A coleta de um conjunto acordado de programas preserva identificador, URL oficial e data de consulta. A repetição não duplica registros. |
| AF-010 | Fontes oficiais | Diferenças entre versões de edital | 5–8 | AF-009 | Mostra alterações de prazo, valores e requisitos entre versões conferidas, com data e referência de ambas. |
| AF-011 | Fontes oficiais | Fila de revisão de registros coletados | 4–7 | AF-009 | Curador autorizado resolve divergências antes de publicar mudanças incertas e registra sua justificativa. |
| AF-012 | Perfil municipal | Indicador CAPAG com referência de origem | 5–9 | Acesso à fonte | Exibe o indicador disponível, período de referência e fonte. Ausência ou desatualização fica explícita na consulta. |
| AF-013 | Elegibilidade | Matriz de requisitos objetivos por edital | 5–8 | #16 | Curador vincula cada regra à versão e ao item do edital, com campo para marcar o requisito como obrigatório. |
| AF-014 | Elegibilidade | Diagnóstico de pendências por requisito | 5–8 | AF-013 | Separa requisito atendido, não atendido e pendente de comprovação e explica a situação com base na regra e na evidência. |
| AF-015 | Governança municipal | Convite institucional de usuário por função | 4–7 | Base V1, #7 | Admin municipal emite convite de uso único com expiração, função e município vinculados pelo servidor. |
| AF-016 | Governança municipal | Desativação e reativação de contas | 4–6 | AF-015, #7 | Desativação revoga sessões na mesma transação. Reativação exige novo login e ambas as ações ficam auditadas. |

## V2 — Preparação de candidaturas, documentação, simulações e IA assistiva

| ID | Frente | Funcionalidade | DP | Dependência | Critério de aceite |
| --- | --- | --- | ---: | --- | --- |
| AF-017 | Documentação | Checklist de documentos por modalidade | 4–7 | AF-013, #19 | Um projeto recebe o checklist da modalidade e apresenta pendências vinculadas aos documentos exigidos. |
| AF-018 | Documentação | Versões de anexos com histórico | 4–7 | #19 | Substituir um documento cria uma nova versão e mantém as versões anteriores acessíveis apenas a perfis autorizados. |
| AF-019 | Documentação | Agenda de validade de documentos | 3–5 | AF-017, AF-018 | Marca comprovantes a vencer e permite identificar os projetos afetados e o responsável pela renovação. |
| AF-020 | Candidaturas | Tarefas por secretaria e responsável | 4–7 | AF-004, AF-015 | Distribui tarefas com prazo e responsável autorizado e registra cada transferência de responsabilidade. |
| AF-021 | Candidaturas | Revisão interna antes da candidatura | 5–8 | AF-017, AF-020, #17 | Uma proposta passa por revisão técnica e autorização interna com registro de autor, data e devoluções. |
| AF-022 | Candidaturas | Registro de protocolo externo | 3–5 | AF-021, #19 | Registra número, data, portal e comprovante da submissão efetuada pela equipe municipal. |
| AF-023 | Candidaturas | Gestão de diligências | 4–7 | AF-020, AF-022 | Cada diligência possui prazo, responsável, resposta e comprovante associados ao protocolo. |
| AF-024 | Acompanhamento | Registro de repasses e marcos previstos | 5–8 | AF-022 | Mostra valores e datas previstos e realizados com comprovantes vinculados ao projeto. |
| AF-025 | Preparação financeira | Orçamento físico-financeiro | 5–8 | AF-004 | Registra etapas, quantidades e custos. Totais reconciliam com as etapas e premissas gravadas. |
| AF-026 | Preparação financeira | Simulação de contrapartida | 3–5 | AF-025 | Calcula o aporte municipal e a diferença para o orçamento disponível com percentuais informados e memória de cálculo. |
| AF-027 | Preparação financeira | Cenários de parcelas de financiamento | 5–8 | AF-025 | Compara cenários de taxa, prazo e carência informados e permite conferir premissas e totais de cada simulação. |
| AF-028 | Inteligência jurídica | Base normativa versionada | 6–10 | AF-013 | Registra fonte, jurisdição e vigência por versão. Consulta histórica recupera a referência usada na análise. |
| AF-029 | Inteligência jurídica | Mapa preliminar de enquadramento por modalidade | 6–10 | AF-014, AF-028 | Apresenta regras e pontos a validar com referências e permite registrar revisão do responsável municipal. |
| AF-030 | AXE AI | Extração assistida de requisitos de edital | 8–13 | AF-018, AF-028 | Cada requisito sugerido indica página ou trecho de origem e segue para revisão humana. Trechos sem evidência ficam pendentes. |
| AF-031 | AXE AI | Busca semântica no catálogo de fomento | 5–8 | AF-009, AF-030 | Recupera oportunidades do catálogo por intenção, com referência, data de consulta e escopo de acesso aplicável. |
| AF-032 | AXE AI | Rascunho assistido de proposta | 6–10 | AF-025, AF-030 | Produz seções editáveis a partir dos dados da prefeitura e assinala os campos que ainda precisam de informação. |
| AF-033 | AXE AI | Revisão e aprovação de conteúdo gerado | 4–7 | AF-030, AF-032 | Um revisor aprova ou devolve uma versão específica e a trilha preserva origem, autoria e decisão. |

## V3 — Rede nacional e internacional, consórcios e indicadores

| ID | Frente | Funcionalidade | DP | Dependência | Critério de aceite |
| --- | --- | --- | ---: | --- | --- |
| AF-034 | Rede de fomento | Diretório de financiadores nacionais | 4–7 | AF-009, AF-011 | Organiza instituições por modalidade e área, com página de referência e data da conferência. |
| AF-035 | Rede de fomento | Catálogo verificado do BNDES Cidades | 5–9 | AF-011, AF-034, acesso à fonte | Registra linhas consultadas e referências oficiais, com estado de disponibilidade e última conferência. |
| AF-036 | Rede de fomento | Catálogo de referências COFIEX | 5–9 | AF-011, AF-034, acesso à fonte | Organiza fontes, documentos e etapas de consulta de financiamento externo com data e referência registradas. |
| AF-037 | Rede de fomento | Radar de cooperação internacional | 6–10 | AF-011, AF-034 | Registra chamadas por instituição, idioma, abrangência e modalidade, com link oficial e estado da conferência. |
| AF-038 | Rede de fomento | Rotas de candidatura por financiador | 4–7 | AF-034, AF-037 | Diferencia candidatura direta, intermediada e a confirmar. Cada rota apresenta etapas e contatos institucionais verificados. |
| AF-039 | Consórcios | Cadastro de consórcio e municípios participantes | 5–9 | AF-015, AF-016 | Mantém vínculos institucionais autorizados e permite remover participação sem conceder acesso à carteira privada do município. |
| AF-040 | Consórcios | Espaço compartilhado de cooperação | 6–10 | AF-021, AF-039 | Compartilha um projeto selecionado com autorização, permissões registradas e revogação de acesso. |
| AF-041 | Gestão | Relatório de conversão por fonte e modalidade | 4–7 | AF-022, AF-034, #21 | Apresenta por período os projetos protocolados, aprovados e recusados, com denominador explícito por fonte. |

## V4 — Avaliação preliminar de maturidade e viabilidade de projetos

| ID | Frente | Funcionalidade | DP | Dependência | Critério de aceite |
| --- | --- | --- | ---: | --- | --- |
| AF-042 | Avaliador inteligente | Entrada de ideia para pré-avaliação | 3–5 | AF-004 | Registra problema, público e objetivo em formulário próprio e identifica a entrada como ideia inicial. |
| AF-043 | Avaliador inteligente | Entrada de projeto documentado | 4–7 | AF-018, AF-042 | Vincula versões específicas dos documentos técnicos e financeiros como evidências da avaliação. |
| AF-044 | Avaliador inteligente | Rubrica ponderada e versionada | 5–8 | AF-013, AF-042 | Valida pesos que somam 100 e preserva a rubrica usada em cada avaliação. |
| AF-045 | Avaliador inteligente | Pontuação de prontidão por maturidade | 5–8 | AF-043, AF-044 | A mesma entrada, evidências e rubrica reproduzem a nota de 0 a 100 e o detalhamento por critério. |
| AF-046 | Avaliador inteligente | Impedimentos eliminatórios separados da nota | 5–8 | AF-014, AF-029, AF-045 | A avaliação sinaliza o impedimento com sua regra e evidência mesmo quando a nota de prontidão é alta. |
| AF-047 | Avaliador inteligente | Plano priorizado de correção de lacunas | 4–7 | AF-045, AF-046 | Converte lacunas confirmadas em ações priorizadas, com justificativa e possibilidade de atribuir responsável. |
| AF-048 | Avaliador inteligente | Simulador de impacto de melhorias na nota | 4–7 | AF-045, AF-047 | Mostra a nota simulada com premissas identificadas e preserva a avaliação registrada. |
| AF-049 | Avaliador inteligente | Revisão e reavaliação versionada | 5–8 | AF-043, AF-046, AF-047 | O revisor registra decisão e justificativa. Uma reavaliação referencia a anterior e discrimina mudanças de evidências e regras. |
| AF-050 | Avaliador inteligente | Relatório PDF de pré-viabilidade | 4–7 | AF-047, AF-049 | O PDF apresenta nota, critérios, impedimentos, evidências, versão, responsável e plano de ação. |

## Primeiro incremento

- **AF-001 e AF-002.** Acrescentar a `/projetos` um formulário GET com `busca` e `situacao`. Consultar por parâmetros SQL no contexto da sessão. Exercitar busca literal por `%` e `_`, busca sem distinção de maiúsculas, combinação dos filtros, filtros inválidos e isolamento.
- **AF-003.** Usar `pagina` com 25 resultados e uma linha adicional para detectar avanço. Ordenar por `created_at DESC, id DESC`. Exercitar a segunda página, a preservação dos filtros e a navegação em páginas vazias.
- **AF-004.** Vincular cada título a `/projetos/[id]`. Validar o UUID e restringir leitura ao município autenticado em `queryForMunicipality`. Verificar o acesso ao projeto próprio, UUID inválido e tentativa de acesso por outra prefeitura.

## Condições de aceite transversais

- Aplicação Next.js/TypeScript/PostgreSQL, interface responsiva em pt-BR, paginação no servidor, autorização a partir da sessão e políticas de isolamento municipal.
- Fontes, datas e versões verificáveis. Dados fictícios explicitamente identificados e dados ausentes sinalizados na interface.
- Cálculos com premissas rastreáveis. Análises jurídicas e saídas da AXE AI com citações e revisão humana. Nota de prontidão e impedimentos eliminatórios exibidos separadamente.
- Código versionado, testes e CI aprovados no commit relevante, incluindo acesso cruzado para itens com dados municipais e falhas de coleta para integrações. A V2–V4 dependem da homologação da V1 conforme a issue #6. A homologação operacional e a liberação de produção são acompanhadas na issue #13.

## Referências do projeto

- [Prompt Master](../PROMPT_MASTER.md) e [roadmap de 12 meses](ROADMAP_12_MESES.md).
- [Antecipação de cinco meses](PLANO_ANTECIPACAO_5_MESES.md), [ingestão oficial](https://github.com/jeffaxe81/axe-fomento/issues/4) e [evolução V2–V4](https://github.com/jeffaxe81/axe-fomento/issues/6).
- [Homologação operacional](https://github.com/jeffaxe81/axe-fomento/issues/13).
