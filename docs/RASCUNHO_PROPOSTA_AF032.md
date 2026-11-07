# AXE Fomento — AF-032 · Rascunho assistido de proposta

## Propósito e natureza

Produzir um documento inicial **editável e não homologado**, contendo
seções que reúnem apenas dados municipais existentes. A geração é
determinística (modelo e dados locais), não corresponde a um LLM e
não faz envio, protocolo, aprovação legal ou consulta externa.

## Utilização

1. Na ficha de projeto, abrir **Rascunho de proposta**.
2. O titular ou administrador municipal gera uma única versão inicial
   a partir do cadastro. É proibido gerar em projeto fictício.
3. O modelo forma seis seções:
   apresentação, justificativa/público beneficiário,
   objetivos, cronograma/execução, orçamento/premissas,
   requisitos e evidências.
4. Fontes usadas no retrato inicial:
   município e projeto; oportunidade vinculada, quando houver;
   primeiras 20 etapas do orçamento e total dos **todos** os itens;
   até 20 requisitos registrados para a oportunidade;
   até 12 sugestões de edital com última revisão **aprovada
   internamente** e trecho de evidência. Esses limites são mostrados
   porque o resumo não é uma reprodução exaustiva do banco.
5. Campos sem dados suficientes ficam assinalados como
   `[PREENCHER E VALIDAR PELA EQUIPE MUNICIPAL]`.
6. Editar todas as seções desejadas, registrar motivo da revisão
   e salvar. É criada a próxima versão (2, 3, 4...); nunca
   substitui ou apaga a anterior. Um formulário antigo retorna
   HTTP 409 por edição concorrente.
7. É possível copiar o texto atual usando a interface.
   O histórico mostra autor, data, justificativa e o texto
   das versões anteriores.

## Modelo de dados

- `project_proposal_drafts`: um registro principal por projeto e
  município, associado ao criador.
- `project_proposal_versions`: todas as versões, seções em JSONB,
  retrato das fontes (`source_snapshot`), lista original de lacunas
  (`missing_fields`), autor, data, origem e nota de revisão.
- `FORCE RLS` por município, controle de ator por sessão,
  FKs compostas e role web com privilégios somente `SELECT/INSERT`.
- Limites: uma minuta por projeto, até 500 versões, seis seções
  com entre 10 e 4000 caracteres cada. Exibição das últimas 50
  versões, sem remover as anteriores.
- O retrato do início é congelado. Alterar posteriormente o orçamento
  ou a matriz **não atualiza silenciosamente** versões já redigidas.
  Uma funcionalidade futura poderá reconciliar o retrato com novas
  fontes mediante aceite explícito do responsável.

## Segurança e ressalvas

- Apenas o titular do projeto ou administrador municipal ativo
  pode gerar/salvar; demais usuários do mesmo município podem
  consultar. Município externo recebe 404.
- A API valida CSRF, sessão, formato JSON, titularidade e
  `expectedVersion`; texto é renderizado com escape seguro.
- As pendências de origem permanecem listadas mesmo que
  a redação seja editada, porque preenchimento manual não
  comprova autenticidade, legalidade ou elegibilidade.
- Textos de requisitos e sugestões são **declarações registradas**,
  não informações automaticamente verificadas em documento oficial.
- A versão inicial não deve ser confundida com a revisão interna
  de candidatura (AF-021) ou com o protocolo externo (AF-022).
- `ENABLE_PROPOSAL_DRAFTS=no` é o padrão; só o CI descartável
  habilita a rota enquanto a issue de homologação #13 está pendente.

## Validação prevista

- Migração 025, repetibilidade e grants de banco.
- Testes com dados reais do PostgreSQL descartável para
  orçamento, exigências e lacunas.
- Autorização no cadastro e revisão, RLS de duas prefeituras.
- Edições concorrentes geram uma versão por número.
- 10.000 casos adicionais e testes Docker/restauração/auditoria.
