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
| AF-010 | Fontes oficiais | Diferenças entre versões de edital | 5–8 | AF-009 | Mostra mudanças em prazo, valores e requisitos estruturados entre versões preservadas. Cada versão tem identificador, data e referência de origem. |
| AF-011 | Fontes oficiais | Fila de revisão de registros coletados | 4–7 | AF-009 | Curador autorizado resolve divergências antes de publicar mudanças incertas e registra sua justificativa. |
| AF-012 | Perfil municipal | Indicador CAPAG com referência de origem | 5–9 | Acesso à fonte | Exibe o indicador disponível, período de referência e fonte. Ausência ou desatualização fica explícita na consulta. |
| AF-013 | Elegibilidade | Matriz de requisitos objetivos por edital | 5–8 | #16 | Curador vincula cada regra à versão ou retificação, ao item e ao trecho da evidência. Requisitos obrigatórios ficam identificados. |
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
| AF-040 | Consórcios | Espaço compartilhado de cooperação | 6–10 | AF-021, AF-039 | O gestor do projeto autoriza participantes a ler um resumo selecionado. A revogação impede também o acesso por link direto. A carteira privada e seus anexos ficam restritos à prefeitura de origem. |
| AF-041 | Gestão | Relatório de conversão por fonte e modalidade | 4–7 | AF-022, AF-034, #21 | Apresenta por período os projetos protocolados, aprovados e recusados, com denominador explícito por fonte. |

## V4 — Avaliação preliminar de maturidade e viabilidade de projetos

| ID | Frente | Funcionalidade | DP | Dependência | Critério de aceite |
| --- | --- | --- | ---: | --- | --- |
| AF-042 | Avaliador inteligente | Entrada de ideia para pré-avaliação | 3–5 | AF-004 | Registra problema, público e objetivo em formulário próprio e identifica a entrada como ideia inicial. |
| AF-043 | Avaliador inteligente | Entrada de projeto documentado | 4–7 | AF-018, AF-042 | Vincula versões específicas dos documentos técnicos e financeiros como evidências da avaliação. |
| AF-044 | Avaliador inteligente | Rubrica ponderada e versionada | 5–8 | AF-013, AF-042 | Valida pesos que somam 100 e preserva a rubrica usada em cada avaliação. |
| AF-045 | Avaliador inteligente | Pontuação de prontidão por maturidade | 5–8 | AF-042, AF-044 e AF-043 para projetos documentados | A mesma entrada, evidências e rubrica reproduzem a nota de 0 a 100 e o detalhamento por critério. Evidência ainda ausente fica explícita conforme o estágio da proposta. |
| AF-046 | Avaliador inteligente | Impedimentos eliminatórios separados da nota | 5–8 | AF-014, AF-029, AF-045 | A avaliação sinaliza o impedimento com sua regra e evidência mesmo quando a nota de prontidão é alta. |
| AF-047 | Avaliador inteligente | Plano priorizado de correção de lacunas | 4–7 | AF-045, AF-046 | Converte lacunas confirmadas em ações priorizadas, com justificativa e possibilidade de atribuir responsável. |
| AF-048 | Avaliador inteligente | Simulador de impacto de melhorias na nota | 4–7 | AF-045, AF-047 | Mostra a nota simulada com premissas identificadas e preserva a avaliação registrada. |
| AF-049 | Avaliador inteligente | Revisão e reavaliação versionada | 5–8 | AF-042, AF-046, AF-047 | O revisor registra decisão e justificativa. Uma reavaliação referencia a anterior e discrimina mudanças de evidências e regras. |
| AF-050 | Avaliador inteligente | Relatório PDF de pré-viabilidade | 4–7 | AF-047, AF-049 | O PDF apresenta nota, critérios, impedimentos, evidências, versão, responsável e plano de ação. |

## Primeiro incremento

- **AF-001 e AF-002.** Acrescentar a `/projetos` um formulário GET com `busca` e `situacao`. Consultar por parâmetros SQL no contexto da sessão. Exercitar busca literal por `%` e `_`, busca sem distinção de maiúsculas, combinação dos filtros, filtros inválidos e isolamento.
- **AF-003.** Usar `pagina` com 25 resultados e uma linha adicional para detectar avanço. Ordenar por `created_at DESC, id DESC`. Exercitar a segunda página, a preservação dos filtros e a navegação em páginas vazias.
- **AF-004.** Vincular cada título a `/projetos/[id]`. Validar o UUID e restringir leitura ao município autenticado em `queryForMunicipality`. Verificar o acesso ao projeto próprio, UUID inválido e tentativa de acesso por outra prefeitura.

## Segundo incremento

- **AF-005.** Em **Radar de oportunidades**, selecionar de duas a três opções e escolher **Comparar seleção**. A tabela mostra órgão, valor com centavos quando conhecido, prazo, área e abrangência. O retorno ao radar recupera os filtros. Registros fictícios ficam identificados em cada coluna.
- **AF-006.** Em **Agenda de prazos**, consultar as datas de hoje até 7, 30 ou 90 dias à frente, com limite final incluído e paginação de 25 registros. A data civil de Brasília também orienta o estado do prazo no radar. Prazos passados ou ausentes aparecem com seu estado no radar.

## Terceiro incremento — personalização por conta
- **AF-007.** Favoritar ou remover oportunidades individualmente, com página **Meus favoritos**. Persistência PostgreSQL com chave por município, usuário e oportunidade; isolamento RLS exige município e ator autenticado. Repetir inclusão não duplica registros.
- **AF-008.** Criar buscas nomeadas, reabrir, renomear, substituir os filtros e excluir, somente na conta atual. Nomes duplicados por conta são rejeitados, ignorando diferenças de caixa. Filtros salvos ficam no servidor, não no armazenamento do navegador.
- **Segurança.** Políticas RLS bloqueiam acesso cruzado entre prefeituras e também entre dois usuários da mesma prefeitura. APIs mutáveis exigem sessão, validação de campos e proteção de origem.
- **Validação.** Testes de integração e ensaios negativos de RLS adicionados. Os itens permanecem sujeitos à aprovação do CI do commit e homologação na issue #13.

## Quarto incremento — base de dados oficiais (pré-homologação)

- **AF-009.** Conector de programas do módulo Gestão de Parcerias, com HTTPS fixo, limite de consumo, validação de estrutura, identificador externo, deduplicação por prefeitura e registro de execução. A coleta é **desabilitada por padrão** até revisão do contrato real e condições de uso. Programas permanecem na área de curadoria, não no radar público.
- **AF-010.** Histórico de versões por programa com checksum e comparação de mudanças em título, órgão e referência de origem. Nova versão exige nova revisão.
- **AF-011.** Fila municipal de programas coletados; somente admin registra aprovação/rejeição com justificativa, trilha de decisões e rejeição de versões obsoletas.
- **Qualidade e segurança.** Isolamento RLS por município, rotas protegidas, dados fictícios nos testes, validação de campos e sem inferência de prazo/valor. A ingestão real e publicação de editais exigem homologação separada.
- **Status:** implementadas no código como fluxo experimental, pendentes de prova com dados reais e aceite operacional. Ver `docs/FONTES_OFICIAIS_TRANSFEREGOV.md` e issue #13.

## Quinto incremento — matriz de requisitos e diagnóstico (AF-013 / AF-014)

- **AF-013:** administrador registra por oportunidade e município requisito obrigatório ou não,
  versão/retificação declarada, seção, trecho textual e URL HTTPS da fonte indicada.
- **AF-014:** equipe registra por projeto status atendido, não atendido ou pendente de comprovação,
  com evidência/justificativa para decisões conclusivas, e contagens descritivas.
- **Proteção:** FK composta vincula projeto e requisito à mesma oportunidade e município; RLS
  reforça o isolamento e a política de ator na inserção. Eventos de mudança são mantidos.
- **Limite importante:** fonte indicada e status são declarações humanas ainda não verificadas
  automaticamente. Não há inferência de regras ou parecer jurídico, nem publicação no radar.
- **Validação:** testes HTTP, banco e integridade, mais CI no commit relevante.
  Detalhes em `docs/MATRIZ_REQUISITOS_DIAGNOSTICO.md`. Homologação operacional permanece NO-GO.

## Sexto incremento — governança municipal (AF-015 e AF-016)

- **AF-015:** convite de uso único, validade de 48 horas, função vinculada à prefeitura
  no banco e aceite com senha criada pela pessoa convidada; sem envio automático.
- **AF-016:** desativação e revogação transacional das sessões, reativação sem recuperar
  sessões antigas, proteção do último administrador ativo e trilha de auditoria.
- **Qualidade:** testes de isolamento, autorização, ataque por origem, concorrência,
  expiração e SQL restrito. Manual: `docs/GOVERNANCA_CONVITES_CONTAS.md`.
- **Status:** implementados em branch para CI e homologação; não entrar em produção.

## Sétimo incremento — CAPAG e checklist documental (AF-012 / AF-017)

- **AF-012:** cadastro manual versionado da classificação CAPAG, ano-base,
  data da edição e URL oficial, com aviso claro de ausência e referência antiga.
  Não é consulta automática nem nota homologada pelo Tesouro.
- **AF-017:** modelos municipais de documentos por modalidade, cópia imutável
  no checklist de cada projeto, três estados com justificativa para decisões,
  histórico, sem anexos (AF-018).
- **Segurança:** RLS, histórico e ator identificável; apenas admin cria modelos
  e registra CAPAG, documentos podem ser acompanhados pela equipe autorizada.
- **Qualidade:** integração e testes negativos para múltiplos municípios;
  homologação operacional pendente.
- **Manual:** `docs/CAPAG_E_CHECKLIST_DOCUMENTAL.md`.

## Oitavo incremento — AF-018, anexos com versões privadas

- Anexos PDF/PNG/JPEG de até 2 MiB, até 20 versões por documento, mantidas sem
  sobrescrita, com autoria, justificativa e data.
- Dados criptografados com AES-256-GCM antes do banco; download com sessão,
  política RLS e cabeçalhos contra cache/incorporação.
- Controle negativo de origem, extensão/MIME, tamanho, corrupção e acesso cruzado.
- **Flag `ENABLE_DOCUMENT_UPLOADS=no` por padrão**: ainda não há AV/quarentena,
  quota, retenção e homologação operacional. Integrado e testado apenas no CI.
- Manual: `docs/ANEXOS_VERSIONADOS_AF018.md`. Não ativar em produção.

## Nono incremento — AF-019: agenda de validade documental

- Datas de validade e responsável da renovação são informados pela equipe, não
  inferidos de documentos ou de normas.
- Agenda municipal com vencidos e vencimentos em 7/30/90 dias, por projeto e
  responsável; fuso America/Sao_Paulo e limites inclusivos.
- Mudança de prazo, transferência de responsabilidade e remoção auditadas sem
  perda do histórico; atualização repetida é idempotente.
- Isolamento por RLS e FKs compostas; não aceita conta inativa ou de outra prefeitura.
- Disponível apenas na branch de desenvolvimento, sujeito ao CI e à homologação.
  **Não há envio automático de notificações externas.**
- Manual: `docs/AGENDA_VALIDADE_DOCUMENTAL_AF019.md`.

## Décimo incremento — AF-020: tarefas por secretaria

- Secretarias municipais cadastradas por administrador, com integrantes ativos
  e autorização granular para receber tarefas.
- Cada tarefa indica projeto, secretaria, responsável, situação, prazo e revisão.
- Troca de responsável dentro da secretaria, status e reprogramação do prazo
  produzem eventos com autoria e justificativa, sem reescrever o passado.
- Controle de concorrência por revisão; RLS e FKs evitam cruzamento de prefeitura.
- Central `/tarefas`, ficha `/projetos/[id]/tarefas` e administração em
  `/administracao/secretarias`.
- Testes negativos de permissões e histórico. Sem notificações externas.
- Manual de implementação: `docs/SECRETARIAS_TAREFAS_AF020.md`.
- **Não é homologação de produção**; mantém NO-GO até aceite operacional.

## Décimo primeiro incremento — AF-021: revisão e autorização internas

- O titular do projeto ou administrador encaminha a candidatura para revisão.
- Revisão técnica, devolução, reenvio e autorização interna com histórico e
  número de revisão otimista; três responsáveis distintos nas etapas completas.
- Portas automáticas contra checklist pendente, tarefas abertas e requisitos
  obrigatórios ainda não atendidos; valores de evidência declarados pela equipe.
- Páginas `/revisoes` e `/projetos/[id]/revisao`, com autorização segregada
  e eventos imutáveis para a role web.
- Sem submissão externa, assinatura digital ou protocolo automático (AF-022).
- Manual: `docs/REVISAO_INTERNA_AF021.md`. Homologação operacional pendente.

## Décimo segundo incremento — AF-022: protocolo externo declarado

- Registro manual do número, nome e HTTPS do portal, data, autor e nota.
- Vínculo obrigatório com revisão AF-021 realmente `authorized`, versão
  imutável de comprovante do mesmo projeto e SHA-256 da prova.
- Bloqueio de protocolos duplicados por município/portal e de URLs locais ou
  sem HTTPS; autenticação, CSRF, RLS e histórico não editável pela aplicação.
- Página `/projetos/[id]/protocolos` com ficha e download autenticado.
- Flag `ENABLE_EXTERNAL_PROTOCOL_RECORDS=no` por padrão.
  Não envia, consulta nem certifica protocolo em órgão externo.
- Manual: `docs/PROTOCOLOS_EXTERNOS_AF022.md`. Homologação pendente.

## Contratos para validação das próximas ondas

- **AF-009.** A issue #4 concentra as condições de configuração, termos de uso, retentativa e monitoramento. Antes da implementação do primeiro conector, registrar conjunto de programas, amostras da fonte e contrato de campos, incluindo prazo ausente e reprocessamento. AF-010 e AF-013 usam a mesma identificação de versão, item e fonte.
- **AF-027.** A primeira versão adota SAC mensal com pagamento de juros na carência. As premissas e os exemplos para homologação estão no [manual do orçamento](ORCAMENTO_FISICO_FINANCEIRO_AF025.md#cenários-de-parcelas--af-027).
- **AF-041.** O período usa a data do protocolo. Uma reapresentação do mesmo projeto na mesma fonte e modalidade integra a mesma coorte, com a situação mais recente até a data de corte.
- **AF-045 e AF-046.** Validar repetibilidade e tratamento uniforme de entradas equivalentes. Uma ideia pode seguir até relatório com requisitos pendentes de comprovação. Impedimentos confirmados exigem regra e evidência.

## Condições de aceite transversais

- Aplicação Next.js/TypeScript/PostgreSQL, interface responsiva em pt-BR, paginação no servidor, autorização a partir da sessão e políticas de isolamento municipal.
- Fontes, datas e versões verificáveis. Dados fictícios explicitamente identificados e dados ausentes sinalizados na interface.
- Cálculos com premissas rastreáveis. Análises jurídicas e saídas da AXE AI com citações e revisão humana. Nota de prontidão e impedimentos eliminatórios exibidos separadamente.
- Código versionado, testes e CI aprovados no commit relevante, incluindo acesso cruzado para itens com dados municipais e falhas de coleta para integrações. Para o início da V2 a V4, registrar o aceite funcional da V1 na issue #2, conforme a dependência da issue #6. A homologação no servidor e o GO de produção são marcos operacionais acompanhados na issue #13.

## Referências do projeto

- [Prompt Master](../PROMPT_MASTER.md) e [roadmap de 12 meses](ROADMAP_12_MESES.md).
- [Antecipação de cinco meses](PLANO_ANTECIPACAO_5_MESES.md), [ingestão oficial](https://github.com/jeffaxe81/axe-fomento/issues/4) e [evolução V2–V4](https://github.com/jeffaxe81/axe-fomento/issues/6).
- [Homologação operacional](https://github.com/jeffaxe81/axe-fomento/issues/13).

## Décimo terceiro incremento — AF-023: diligências por protocolo

- Registro manual de diligência vinculada a protocolo externo do próprio projeto,
  com prazo, responsável municipal ativo, título e orientação; sem transmissão a portal.
- Resposta municipal com texto e comprovante *versionado* do mesmo projeto; a
  aplicação grava SHA-256 e versão do comprovante. Edição concorrente rejeitada.
- Autoria e estados preservados em eventos sem UPDATE/DELETE pela role web.
- Somente administrador ou titular do projeto cria; administrador ou responsável
  designado responde. RLS, FK composta e anti-CSRF impedem vínculos cruzados.
- Flag `ENABLE_DILIGENCE_RECORDS=no` por padrão, pendente de homologação.
- Manual: `docs/DILIGENCIAS_PROTOCOLO_AF023.md`.

## Décimo quarto incremento — AF-024: repasses e marcos previstos/realizados

- Banco com cronograma previsto, realização declarada, valores exatos em centavos,
  projeto/município, protocolo externo e comprovante vinculado à versão original.
- Criação por titular ou administrador. Realização por titular ou administrador,
  com data, valor efetivo, justificativa e versão privada do documento AF-018.
- Controle de revisão para concorrência, trilha de eventos sem UPDATE/DELETE pela
  role web; FORCE RLS e FKs compostas garantem isolamento de cada prefeitura.
- Interface `/projetos/[id]/financeiro` com totais dos repasses exibidos,
  prazos e comprovantes. Nenhum total é prova de movimentação bancária.
- `ENABLE_FINANCIAL_TRACKING=no` por padrão e `yes` apenas no CI isolado.
- Manual: `docs/REPASSES_E_MARCOS_AF024.md`. Depende de homologação AF-018/AF-022.

## Décimo quinto incremento — AF-025: orçamento físico-financeiro

- `sql/020_project_budget.sql`: etapas numeradas com período e premissas,
  itens físicos com unidade, quantidade exata até 0,001 e preço por unidade.
- O banco gera o total monetário de cada item com arredondamento half-up,
  como centavos inteiros, sem ponto flutuante; subtotais são `SUM` de itens
  e total geral é `SUM` de todos os itens, mesmo além do limite de exibição.
- Registros são append-only para o papel web e possuem evento com autor e data;
  FORCE RLS e FK composta vinculam município/projeto/etapa/item.
- APIs: `POST /api/projects/budget/stages` e
  `POST /api/projects/budget/items`, acessíveis ao titular ou admin municipal.
- Interface: `/projetos/[id]/orcamento`, comparação total geral versus
  soma dos subtotais e explicação de premissas e custos.
- `ENABLE_PROJECT_BUDGET=no` até homologação, ativado apenas em CI isolado.
- Referência de operação: `docs/ORCAMENTO_FISICO_FINANCEIRO_AF025.md`.
- **Não é** aprovação, cotação oficial, planilha de contratação, conciliação
  bancária ou ferramenta de empenho. Não permite edição/exclusão no MVP;
  alterações exigirão novo fluxo de revisão e trilha futura.

## Décimo sexto incremento — AF-026 e busca do radar

- **AF-026.** O orçamento do projeto oferece simulação de contrapartida com
  a soma do AF-025, percentual municipal de 0 a 100 e valor disponível
  informado pela equipe. O cálculo em centavos mostra aporte, valor restante,
  falta ou sobra e memória de cálculo. Os dados da simulação ficam na página.
- **Issue #14.** O radar aplica os filtros combinados de título/órgão e área
  a todo o catálogo antes de paginar 25 resultados. A ordem é por cadastro
  recente, com desempate por ID. Ao voltar da comparação, a página e os
  filtros são recuperados.
- **Validação.** Testes cobrem caracteres literais e caixa acentuada,
  registros fora dos 100 cadastros mais recentes, reconciliação da base da
  simulação e tentativas de leitura e inserção entre contas no PostgreSQL.
  A homologação operacional segue na issue #13.

## Décimo sétimo incremento — AF-027

- **Cenários de parcelas.** A página do projeto compara dois cenários SAC
  com o mesmo principal e premissas próprias de taxa mensal, amortização e
  carência. O total do orçamento é a base sugerida. A equipe pode informar
  outro principal e conferir juros, prazo, parcelas e total pago.
- **Validação.** Os testes cobrem reconciliação em centavos, limites da
  simulação, acesso à página e isolamento entre municípios. A homologação
  operacional segue na issue #13.

## Décimo oitavo incremento — AF-028: base normativa versionada

- Cadastro manual de referências jurídicas por município, código, título,
  jurisdição (federal/estadual/municipal) e UF pertinente.
- Histórico append-only por referência: URL da fonte, publicação informada,
  vigência inicial/final informada, artigo, trecho e justificativa; versão
  vinculada a identificador imutável e impressão SHA-256 dos metadados.
- Somente administrador municipal ativo pode incluir referência ou versão.
  Analistas visualizam históricos completos; outras prefeituras não os veem.
- Controle otimista de concorrência por `expectedVersion`: revisão atrasada
  recebe conflito 409, não sobrescreve dados históricos.
- `/normativos` para consulta/registro e `/normativos/[id]` para
  identificação e recuperação exata de cada versão.
- Nova migração `021_normative_sources.sql`, FORCE RLS, chaves compostas,
  índices por município e grant somente `SELECT,INSERT` para a role web.
- Validações de URL HTTPS pública, calendário civil, datas e caracteres;
  nunca executa fetch da URL informada.
- `ENABLE_NORMATIVE_REGISTRY=no` por padrão, habilitada somente no CI
  descartável. Referências **não são autenticações oficiais nem pareceres**.
- Manual: `docs/BASE_NORMATIVA_AF028.md`.

## Décimo nono incremento — AF-029: enquadramento por modalidade

- Página `/projetos/[id]/enquadramento` com modalidades do AF-017,
  resumo de pendências e critérios documentados por pessoas autorizadas.
- Cada critério aponta para o **ID da versão normativa exata** registrada
  no AF-028, preservando fonte, número da versão, trecho e SHA-256 da
  declaração consultada.
- Revisão humana por titular do projeto ou administrador municipal
  com status declarado, evidência/justificativa e controle otimista
  de concorrência (`expectedRevision`).
- Histórico de avaliações em
  `/projetos/[id]/enquadramento/[checkId]`, sem UPDATE/DELETE pela role web.
- Integração de navegação à matriz de requisitos AF-013/014, sem
  inferência automática de elegibilidade por critérios cadastrados.
- Migração `022_project_modality_map.sql`, APIs POST de cadastro/revisão,
  política FORCE RLS, testes intermunicipais e segurança HTTP no CI.
- A bateria adicional de 10.000 cenários permanece obrigatória.
- Flag `ENABLE_MODALITY_MAP=no` até homologação jurídica e operacional.
- Manual: `docs/MAPA_ENQUADRAMENTO_AF029.md`.

## Vigésimo primeiro incremento — AF-030: sugestão assistida de requisitos de edital

- Tela `/projetos/[id]/extracao-edital` recebe **texto fornecido pela
  equipe**, vinculado a uma **versão de PDF criptografado** registrada no
  AF-018, sem buscar conteúdo do PDF automaticamente. Marcadores
  `PÁGINA N` preservam páginas indicadas pelo operador; na ausência,
  o trecho original ainda identifica a fonte textual para revisão.
- Extrator heurístico determinístico encontra até 25 possíveis exigências
  por lote (palavras de obrigação). **Não usa OCR nem modelo generativo**,
  não inventa regras, páginas ou evidências e não certifica correspondência
  entre o texto colado e o PDF anexado.
- Armazena apenas hash SHA-256 do texto de entrada, tamanho, fragmentos
  sugeridos, versão de documento, observação, autoria e data; o texto
  integral fornecido não é guardado no banco.
- Trechos curtos ou sem evidência suficiente permanecem pendentes,
  com aprovação interna bloqueada via validação SQL; o revisor pode
  rejeitar ou registrar pendência documentada.
- Revisões com decisão e justificativa geram eventos imutáveis, controle
  otimista por `expectedRevision`, e histórico separado por sugestão.
  **Aprovação interna não cria requisito automaticamente na matriz AF-013**.
- Migração `023_edict_suggestions.sql`, FORCE RLS, vínculos compostos
  por município/projeto/documento, grants `SELECT/INSERT`, APIs POST
  para geração de lote e revisão humana, flag
  `ENABLE_EDICT_ASSISTED_EXTRACTION=no` por padrão.
- Testes unitários, duas prefeituras e casos adversariais HTTP/RLS
  executados junto à bateria de 10.000 cenários no CI.
- Manual: `docs/EXTRACAO_ASSISTIDA_AF030.md`.

## Vigésimo segundo incremento — AF-031: busca por intenção no catálogo

- Busca textual orientada a objetivos, em português, com expansão
  temática explícita e PostgreSQL Full Text Search (`portuguese`).
- Oferece relevância explicável baseada em título, área e órgão, sem
  modelo generativo, embeddings ou serviço externo; pagina **depois**
  de consultar e ordenar todo o catálogo, não somente os itens recentes.
- Duas categorias separadas: oportunidades públicas cadastradas no
  radar; e programas da API Transferegov já **revisados pela prefeitura**
  (`review_state='approved'`), filtrados por município via FORCE RLS.
  Programas pendentes/rejeitados nunca aparecem nas consultas.
- Exibe fonte indicada e data real disponível. Oportunidades sem
  observação oficial mostram **data da consulta não disponível**, sem
  sugerir comprovação de edital aberto. Programas mostram
  `last_seen_at`, a observação registrada no AF-009.
- Página `/oportunidades/semantica`, API autenticada
  `GET /api/opportunities/semantic`, navegação no radar e sidebar.
- Migração `024_semantic_catalog_search.sql` cria índices GIN em
  texto português e índice municipal de fontes aprovadas.
- `ENABLE_SEMANTIC_CATALOG=no` até homologação operacional.
- Testes unitários de intenções/limites e integração com PostgreSQL,
  paginação, fonte curada, não exposição cross-tenant e segurança da API.
  Suíte determinística adicional de 10.000 casos mantida no CI.
- Manual: `docs/BUSCA_SEMANTICA_AF031.md`.
- Revisão coordenada: `docs/AF031_DEZ_FRENTES.md`.

## Vigésimo terceiro incremento — AF-032: rascunho assistido de proposta

- Página `/projetos/[id]/proposta` com seis seções de proposta: contexto,
  justificativa, objetivos, execução, orçamento e requisitos.
- O texto inicial é gerado **deterministicamente** a partir de dados
  declarados do município, projeto, oportunidade, etapas/custos do AF-025,
  matriz AF-013/014 e sugestões do AF-030 com última avaliação
  interna `aprovada`. Não utiliza LLM, OCR ou APIs externas.
- Lacunas de informação aparecem como `[PREENCHER E VALIDAR PELA EQUIPE
  MUNICIPAL]`; lista de pendências é preservada no snapshot das fontes,
  incluindo público beneficiário, metas, orçamento, exigências e edital.
- Titular ou administrador municipal pode editar e salvar novas versões
  completas. Edições não substituem versões antigas nem a origem do
  conteúdo; colisões retornam HTTP 409 por `expectedVersion`.
- A versão gerada é um **rascunho interno**, não declaração de
  regularidade, habilitação, autenticidade jurídica ou protocolo.
- Migração `025_proposal_drafts.sql` implementa tabelas append-only
  `project_proposal_drafts` e `project_proposal_versions`, FORCE RLS,
  FKs por município, privilégio mínimo `SELECT/INSERT` e limites de seção.
- APIs POST `/api/projects/proposals` (geração inicial) e
  `/api/projects/proposals/revisions` (edição auditável).
- Testes unitários, integração em duas prefeituras, CSRF, concorrência,
  imutabilidade e limites de texto. A suíte determinística de
  10.000 casos permanece obrigatória no CI.
- `ENABLE_PROPOSAL_DRAFTS=no` por padrão até homologação.
- Manual: `docs/RASCUNHO_PROPOSTA_AF032.md`.

## Vigésimo quarto incremento — AF-033: revisão editorial da versão gerada

- Fluxo de revisão editorial com decisões `aprovada` e `devolvida`
  para **versão imutável exata** do rascunho AF-032. A aprovação é
  **somente interna**, não equivale a protocolo de proposta, homologação
  jurídica, validação de edital ou concessão de recursos.
- Apenas administrador municipal ativo, **distinto do autor daquela
  versão**, pode decidir; projeto fictício não pode receber decisão.
  Analistas/titulares podem consultar o histórico, não aprovar.
- O conteúdo com `[PREENCHER E VALIDAR ...]` não pode receber
  aprovação editorial. O aprovador precisa declarar ciência de
  pendências e fontes ainda não verificadas, mesmo que o texto tenha
  sido preenchido manualmente.
- Revisões são eventos append-only com autor, data, justificativa,
  decisão e versão exata, com `expectedReviewRevision` para detectar
  concorrência (HTTP 409). Uma nova versão não herda aprovação anterior.
- Tela `/projetos/[id]/proposta` mostra estado da versão atual
  e acesso às decisões históricas por versão.
  `/projetos/[id]/proposta/revisoes/[versionId]` mostra trilha completa.
- API `POST /api/projects/proposals/reviews` com autenticação, CSRF,
  Zod `.strict()`, autorização municipal e validação SQL atômica.
- Migração `026_proposal_content_reviews.sql`, FORCE RLS,
  FKs compostas por município/projeto/rascunho/versão e role web
  com apenas `SELECT,INSERT`.
- Testes unitários e integração incluindo separação autor/revisor,
  duas prefeituras, pendências, decisão em versão desatualizada,
  concorrência e integridade da trilha. Mantida bateria de 10.000
  cenários determinísticos.
- Por padrão `ENABLE_PROPOSAL_CONTENT_REVIEWS=no` até homologação.
- Manual: `docs/REVISAO_CONTEUDO_AF033.md`.
- Coordenação de cinco frentes: `docs/AF033_CINCO_FRENTES.md`.

## Vigésimo quinto incremento — AF-034: diretório de financiadores nacionais

- Cadastro manual das **referências de instituições nacionais** por cada
  prefeitura (catálogo próprio do município), com código, instituição,
  natureza, **modalidades** e **áreas temáticas** controladas.
- Exibe página HTTPS de referência, seção, nota documental e data da
  **consulta humana declarada**, quando existir, com situação:
  `referencia_informada`, `consultada_internamente` ou
  `revisao_necessaria`.
- **Não é uma lista de editais abertos, linha com recursos disponíveis,
  cotação, taxa, aprovação jurídica ou evidência de crédito concedido.**
  Nenhuma instituição ou produto foi inventado ou importado de fonte
  externa automaticamente; a equipe precisa conferir cada fonte.
- Página `/financiadores` com busca literal por nome/código,
  filtros por modalidade e tema, paginação de 25 após consulta integral;
  detalhe `/financiadores/[id]` com histórico.
- APIs `POST /api/financiers` e `POST /api/financiers/versions`:
  somente administrador municipal ativo, validação de URL pública
  HTTPS, datas não futuras, tags controladas, CSRF e parâmetros SQL.
  Nova conferência exige `expectedVersion` (409 em concorrência).
- Migração `027_financier_directory.sql`: `municipal_financiers`,
  `municipal_financier_versions`, versões imutáveis, SHA-256 de
  metadados **declarados**, FORCE RLS, FKs municipais, role `SELECT/INSERT`.
- `ENABLE_FINANCIER_DIRECTORY=no` por padrão até homologação.
- Testes unitários e PostgreSQL/HTTP: cadastros de duas prefeituras,
  filtros, paginação, histórico, situação de conferência, CSRF, RBAC,
  conflito, restrição de UPDATE/DELETE e 10.000 cenários no CI.
- Manual `docs/DIRETORIO_FINANCIADORES_AF034.md`; revisão técnica
  organizada em seis frentes `docs/AF034_SEIS_FRENTES.md`.

## Vigésimo sexto incremento — AF-035: catálogo de fontes BNDES Cidades

- **37 referências institucionais reais** de soluções vinculadas pelo portal
  `https://cidades.bndes.gov.br/` consultado em 07/11/2026.
  Cada entrada inclui título, área, resumo de referência e **link
  exato** da página da solução oficial. O número de 37 representa
  páginas únicas identificadas em diferentes perfis, **não**
  quantidade de linhas de crédito abertas e nem total exibido para
  todo porte municipal em uma busca específica.
- Dataset público nacional `bndes_city_solutions` carregado
  pela migração `028_bndes_cities_catalog.sql`, com revisão do
  índice oficial declarada na data de referência. Não há
  scraping em produção, download automático ou inferência
  de condições e taxas.
- Página `/bndes-cidades`: busca literal, filtros por área,
  conferência municipal, estado da fonte e disponibilidade
  **declarada**, ordenação determinística, paginação de 25 e
  painel com contagem de referências conferidas/pendentes.
- Página `/bndes-cidades/[code]`: URL oficial, histórico
  append-only, responsável, data, nota, revisão, SHA-256 dos
  metadados e alertas de conferência com idade 90+ dias.
- Estados de fonte: página conferida pela equipe,
  atualização pendente, página indisponível. Estados de
  disponibilidade declarada: não apurada, possibilidade
  mencionada sem oferta confirmada, oferta não localizada.
  Nenhum estado afirma crédito aprovado, taxa atual,
  condição jurídica ou disponibilidade em tempo real.
- **Alto volume de revisão:** componente de seleção e API
  `POST /api/bndes-cidades/reviews/batch` para 1 a 20
  referências por requisição, com nota, data, estado, confirmação
  das limitações e `expectedRevision` por item. Gravação
  atômica (todas ou nenhuma), serialização por município e
  conflito HTTP 409 quando há versões divergentes.
- Segurança: somente administrador ativo grava; usuários
  autenticados consultam referências nacionais, mas as
  avaliações municipais são isoladas por `FORCE RLS`.
  Role web possui apenas SELECT e INSERT nos eventos,
  e SELECT no catálogo global.
- `ENABLE_BNDES_CITY_CATALOG=no` por padrão até
  homologação da issue #13. Sem merge nem deploy automático.
- Testes: integridade das 37 URLs, filtros, paginação,
  registro unitário, lote de 20, falha fechada em stale,
  concorrência com revisão individual, CSRF, papeis,
  RLS intermunicipal, imutabilidade e 24 consultas HTTP
  simultâneas (verificação funcional, não benchmark de RPS).
  Os 10.000 casos determinísticos do CI continuam obrigatórios.
- Documentação `docs/BNDES_CIDADES_AF035.md` e
  `docs/AF035_FRENTES_ACELERACAO.md`.

## Vigésimo sétimo incremento — AF-036: catálogo COFIEX/PFE e consulta por projeto

- Catálogo público nacional com **8 links oficiais identificados** do
  Ministério do Planejamento e do Portal de Financiamento Externo
  (PFE): página da COFIEX, portal, legislação consolidada,
  reuniões, calendário/pautas, perguntas frequentes,
  capacitação e notícia/guia prático 2026.
- **12 etapas internas de referência** ordenadas: escopo,
  enquadramento normativo, orientações, critérios, acesso ao
  PFE, preenchimento, validação/envio formal (externo), reunião
  técnica GTEC, Pré-COFIEX, deliberação, negociação e execução.
  Trata-se de roteiro para organização documental, não
  da certificação de marcos ou status oficiais.
- Migração `029_cofiex_reference_catalog.sql`: catálogos globais
  `cofiex_official_references`, `cofiex_consultation_stages`
  somente leitura para a role web; eventos append-only de
  `project_cofiex_consultation_events` restritos por município
  e projeto via `FORCE RLS` e FKs compostas.
- Cada consulta humana registra etapa, código e URL oficial
  congelados, autor, data, justificativa, estado, versão e
  SHA-256 dos **metadados declarados**; jamais um comprovante
  do próprio portal PFE ou de aprovação COFIEX.
- API `POST /api/projects/cofiex/checks`: autenticação,
  CSRF, Zod estrito, autorização admin/titular do projeto,
  ausência de oportunidades fictícias, data não futura,
  controle de concorrência `expectedRevision` e gravação
  imutável (HTTP 409 em conflito).
- Interfaces `/cofiex` (fontes) e `/projetos/[id]/cofiex`
  (roteiro e observações) com trilha versionada individual em
  `/projetos/[id]/cofiex/[stage]`, todas com links
  oficiais, avisos jurídicos e recomendação de reconferência
  após 90 dias.
- `ENABLE_COFIEX_CATALOG=no` por padrão. Testes unitários e
  PostgreSQL/HTTP com duas prefeituras, autorizações, sessões,
  CSRF, concorrência, projeto fictício, integridade de seed,
  RLS, role sem UPDATE/DELETE e histórico.
- O sistema **não acessa, preenche nem protocola o PFE**,
  não classifica decisões da COFIEX e não importa dados
  de financiamento externo automaticamente.
- Documentos `docs/COFIEX_AF036.md` e
  `docs/AF036_OITO_FRENTES.md`.

## Incrementos AF-037 a AF-040: meta de 80% (40 de 50 funcionalidades)

- **AF-037 — Cooperação internacional.** Registra chamadas/referências
  por instituição, idioma, abrangência, modalidade, URL HTTPS,
  data humana de conferência e status sem afirmar chamada aberta.
  Tabela `international_cooperation_calls`; API
  `POST /api/cooperation/calls`, tela `/cooperacao`.
- **AF-038 — Rotas de candidatura.** Vincula a chamada uma ou mais
  rotas diretas, intermediadas ou pendentes de confirmação, com
  contato institucional, URL e passos documentais. Registro
  humano não verifica candidatura automática. Tabela
  `international_application_routes` e
  `POST /api/cooperation/routes`.
- **AF-039 — Consórcios municipais.** O administrador da
  prefeitura fundadora cria consórcio e convida outra
  prefeitura; adesão depende de aceite expresso por
  administrador do município convidado. Recusa/revogação
  registrada em `consortium_membership_events`. Tabelas
  `municipal_consortia`, `consortium_memberships`,
  APIs `/api/consortia`, `/invitations`,
  `/membership-state` e tela `/consorcios`.
- **AF-040 — Espaço compartilhado de cooperação.** Apenas
  título e resumo explicitamente redigidos pelo gestor/
  administrador do projeto de origem, com justificativa,
  são publicados ao consórcio. Administradores ativos de
  municípios com adesão aceita podem ler o resumo, mas
  nunca a carteira original ou seus anexos.
  `consortium_project_shares`, `consortium_share_events`,
  APIs de criação/revogação e página de URL direta
  `/consorcios/compartilhados/[id]`. Revogação do resumo
  ou da adesão elimina imediatamente novos acessos.
- Cinco migrações `030` a `034`, total **34** após correção aditiva de RLS,
  com FORCE RLS, role de menor privilégio e constraints
  compostas; flags de escrita default `no`.
- Testes aprovados em CI: três prefeituras, autenticação, CSRF,
  distinção entre convite e adesão, proibição de acesso
  direto a projetos, revogação, concorrência,
  UPDATE/DELETE negados e bateria geral de 10.000.
- Implementação corresponde a **40/50 = 80% do backlog de código
  com CI integral aprovado**. Homologação
  legal/operacional issue #13 permanece pendente.
- Manual: `docs/AF037_AF040_ENTREGA_80.md`.
