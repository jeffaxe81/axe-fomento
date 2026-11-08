# AXE Fomento — AF-035: catálogo BNDES Cidades

## Fonte e limites da verificação

- Fonte primária: https://cidades.bndes.gov.br/
- Referência institucional: https://www.bndes.gov.br/wps/portal/site/home/onde-atuamos/municipios
- Data do levantamento editorial de links: **07/11/2026**.
- Foram identificadas **37 páginas diferentes de solução** no
  portal oficial, incluindo variantes com perfis municipais distintos.
  O indicador "23 resultados" visto em determinado filtro do
  portal não deve ser interpretado como total de referências únicas.
- Para cada entrada, o catálogo identifica título, assunto e URL de
  solução publicada no domínio oficial. Isso **não** representa
  certificação de oferta de crédito, valor disponível, taxa, prazo,
  elegibilidade, habilitação, contrato ou aprovação.
- A verificação do catálogo é documental/editorial: não é
  monitoração em tempo real das páginas. Uma alteração no
  portal não atualiza automaticamente o conteúdo já registrado.
- O portal BNDES Cidades possui filtros populacionais próprios.
  O AXE não presume enquadramento por porte municipal a partir
  do título ou da URL; o filtro oficial deve ser conferido antes
  de avançar com a solicitação.

## Dados

- `bndes_city_solutions`: 37 referências nacionais de consulta
  **globais, pré-identificadas** e imutáveis para a role web.
  O nome "verificado" refere-se ao domínio e à página oficial
  identificada. `reference_observed_on` é data do levantamento
  de links, não data da última aprovação do BNDES.
- `municipal_bndes_review_events`: conferência **humana
  declarada** pelo administrador de um município. Histórico
  append-only, cada evento tem código, revisão 1..1000, estado,
  observação, data da consulta, URL congelada, SHA-256 dos
  metadados e responsável. A conferência de um município
  não é exibida por outro.
- Estados da fonte:
  `pagina_conferida`, `atualizacao_pendente`,
  `pagina_indisponivel`.
- Estados de disponibilidade:
  `nao_apurada`, `possibilidade_mencionada`,
  `nao_localizada`. O termo "possibilidade" é
  intencional para evitar afirmação de oferta operacional.
- Data de consulta: fornecida pelo administrador, formato
  ISO, até a data atual, com bloqueio de datas inválidas.
- Revisões com mais de 90 dias exibem recomendação de
  nova conferência, sem declarar que o BNDES alterou a linha.

## Uso e fluxo de trabalho

1. Abrir `/bndes-cidades` e pesquisar por área, nome,
   situação de referência, disponibilidade informada
   ou ausência de conferência municipal.
2. Abrir o detalhe e consultar o link do BNDES.
3. Registrar observação humana, com a ciência expressa de
   que fontes e condições financeiras dependem de nova
   confirmação. Apenas administrador ativo pode registrar.
4. Para avaliar até **20 referências de uma vez**, selecionar
   entradas na página e informar nota, estado, data e ciência.
   O mesmo texto descritivo será registrado em cada referência
   escolhida, com eventos e fingerprints individualizados.
5. Em caso de conflito com nova revisão de outro usuário
   (HTTP 409), **nenhuma** avaliação do lote é gravada.
   O usuário deve recarregar a lista para consultar os
   números mais recentes e reenviar.
6. Manter documentação de habilitação, orçamento,
   cronograma e requisitos do financiamento na etapa
   de preparação do pedido. AF-035 não protocola o
   pedido junto ao BNDES.

## Segurança

- A fonte oficial já está cadastrada e não admite URL
  arbitrária vinda do corpo da API: reduz riscos de SSRF.
- Referências globais têm permissão `SELECT`;
  avaliações têm `FORCE RLS` e permissão apenas
  `SELECT, INSERT` para `fomento_app`.
- Escrita via `POST /api/bndes-cidades/reviews/batch`
  validada por `zod.strict()`, sessão, CSRF,
  administrador municipal ativo, data e tags controladas.
- Gravação transacional em lote com trava consultiva
  por município e precondições de versão.
- Conflitos de unicidade causam rollback da instrução
  inteira, sem criação parcial de eventos.
- Histórico de revisão limitado às 100 últimas versões
  na interface; anteriores continuam no banco.
- A ativação depende de `ENABLE_BNDES_CITY_CATALOG=yes`.
  Padrão é `no` até homologação.

## Testes e próximos passos

- CI valida 28 migrações repetíveis, conteúdo do seed,
  páginas e filtros, 20 gravações simultâneas em lote,
  revisão concorrente, RLS de duas prefeituras,
  status e datas, restrição a UPDATE/DELETE, 24
  leituras simultâneas e 10.000 cenários determinísticos.
- Esses 24 HTTP GET simultâneos não são uma medição de
  capacidade operacional, RPS ou garantia de SLA.
- Possível evolução: monitoramento oficial agendado,
  políticas de expiração, per-filiação de cada programa
  e integração com análise documental específica,
  condicionados à autorização de acesso e homologação.
