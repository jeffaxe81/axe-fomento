# AXE Fomento — AF-031: Busca por intenção no catálogo

## Objetivo

Ajudar a equipe municipal a encontrar oportunidades e programas
relacionados a necessidades concretas, como "melhorar postos de saúde",
"ampliar creches" ou "saneamento e água", mesmo quando a redação
dos cadastros utiliza termos próximos.

## Como funciona

A entrada é interpretada com uma lista **local, explícita e auditável**
de termos relacionados. A busca utiliza PostgreSQL Full Text Search
com configuração de idioma português e organiza os resultados por
pontuação de relevância (título mais relevante que área e órgão),
data e identificador estável.

**Não é uma busca com embeddings nem IA generativa.**
A ampliação do vocabulário requer revisão do dicionário; termos não
mapeados ainda podem ser encontrados por stemming ou texto literal.
Não há chamada a modelos ou APIs externas durante a pesquisa.

## Onde acessar

- Menu principal → Busca por intenção.
- Radar de oportunidades → Busca por intenção.
- API autenticada: `GET /api/opportunities/semantic?intencao=...&tipo=oportunidades&pagina=1`.
- `tipo=programas` pesquisa apenas registros municipais revisados.

Cada consulta retorna até 25 resultados, com paginação estável por
relevância e data. Texto da busca limitado a 120 caracteres, página
limitada à faixa 1–100, no máximo 40 termos expandidos.

## Proveniência e escopo de acesso

- **Oportunidades**: catálogo compartilhado já existente no radar.
  Exibe data de cadastro (`created_at`) e a fonte indicada, se houver.
  **Não existe timestamp confiável da consulta ao site externo nesta
  tabela; portanto a interface indica que a data da consulta não está
  disponível.** Exemplo fictício permanece claramente marcado.
- **Programas revisados**: registros municipais `source_programs`
  com `review_state='approved'`. A prefeitura tem acesso apenas aos
  seus registros, via `FORCE RLS` da estrutura AF-009.
  O campo `last_seen_at` identifica a última observação/coleta do
  registro e `version` sua versão interna. A URL é a referência
  de endpoint da API, não uma página de edital específico.
- Programas coletados **não são publicados como oportunidades** nem
  considerados automaticamente editais abertos.

## Controles de segurança e qualidade

- Sessão obrigatória para página e API. Identidade municipal vem da
  sessão; o cliente não escolhe o `municipality_id`.
- API aceita parâmetros GET limitados e retorna `cache-control: no-store`.
  Termos são enviados como parâmetros SQL tipados JSONB, sem
  concatenar conteúdo do usuário na instrução SQL.
- Sem login a API retorna 401 e a página redireciona ao login.
- `ENABLE_SEMANTIC_CATALOG=no` por padrão, `yes` somente
  no CI descartável. A consulta de produção requer aceite da issue #13.
- Testes de fonte revisada/pedente/rejeitada, RLS entre prefeituras,
  sinônimos, ranking/paginação, campo de origem e tentativa de injeção.
- Limitações: busca temática com dicionário finito, possíveis
  falsos positivos e falsos negativos, sem dados externos em tempo real.
  Pontuação de relevância **não é pontuação de elegibilidade**.
