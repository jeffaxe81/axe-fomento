# AXE Fomento — AF-033 · Revisão e aprovação editorial de minutas

## Escopo

Permitir que um revisor municipal aprove editorialmente ou devolva
**uma versão específica** do documento gerado/editado no AF-032.
A decisão só significa revisão interna do texto. Não habilita
autenticação de documentos, publicação de edital, submissão,
aprovação jurídica, aprovação de financiamento nem pagamento.

## Papéis e separação de responsabilidades

- Autor: titular/administrador municipal autorizado a salvar versões
  de minuta (AF-032).
- Revisor: **administrador ativo**, mas não pode ser o criador da
  versão que está avaliando. Deve existir outro administrador para
  revisar uma versão escrita por um administrador.
- Leitor: usuário com sessão no mesmo município pode consultar
  conteúdo e histórico, mas analista não pode emitir aprovação.
- Projeto atrelado a oportunidade fictícia: não aceita novas revisões.

## Passos de uso

1. Abra `/projetos/{id}/proposta`.
2. Na seção Revisão editorial, a versão atual aparece como
   `Pendente de revisão editorial`, `Aprovada somente para revisão
   editorial interna` ou `Devolvida ao redator para ajustes`.
3. Administrador que não seja o autor escolhe **Aprovar** ou
   **Devolver**, com justificativa de pelo menos 15 caracteres.
4. Para aprovar, deve reconhecer explicitamente que as informações,
   origens e pendências exigem conferência jurídica/documental externa.
   Aprovação é bloqueada se qualquer seção ainda contém o marcador
   `[PREENCHER E VALIDAR`.
5. A decisão e o revisor ficam vinculados ao ID UUID da versão.
   Histórico antigo permanece visível após alterações.
6. Se outra revisão foi gravada ou se o usuário tenta revisar
   uma versão que deixou de ser a última, a gravação é recusada
   (409 ou 404, conforme o contexto). Nova versão precisa de
   revisão própria.

## Integridade e concorrência

- Tabela `project_proposal_review_events` (migração 026).
  `UNIQUE(version_id,revision)` e FKs compostas protegem
  o vínculo da versão/município/projeto/rascunho.
- Eventos append-only para a role web (`SELECT,INSERT` apenas).
- `expectedReviewRevision` protege contra edições simultâneas,
  e `ON CONFLICT DO NOTHING` faz uma delas retornar HTTP 409.
- `FORCE RLS` limita leitura/gravação ao tenant da sessão.
- Campos de decisão são validados no HTTP e novamente na SQL;
  aprovação exige reconhecimento explícito, ausência de
  marcadores e revisor distinto do autor.
- O histórico na interface pode exibir até 1000 eventos da
  versão, sem apagar os mais antigos do banco.

## Limitações

- Futura revisão jurídica/operacional continua fora deste aceite.
- Apenas a versão mais recente do rascunho recebe nova decisão.
  Uma versão histórica pode ser consultada, mas não alterada.
- Decisões não impedem o autor autorizado de criar versão posterior;
  a versão mais recente começa sem decisão.
- Fontes congeladas no AF-032 e as pendências originais continuam
  inalteradas, mesmo após aprovação editorial. A conferência
  de atualidade com a origem deve ser realizada pelo revisor.
- `ENABLE_PROPOSAL_CONTENT_REVIEWS=no` em produção; CI habilita
  `yes` somente em ambiente descartável.
- A issue de homologação #13 bloqueia merge/deploy até aceite.

## Testes

Verificar CSRF, ausência de sessão, permissão de analista,
revisor autor, RLS de outra prefeitura, histórico imutável,
recusa de conteúdo com placeholders, ciência explícita de
lacunas, concorrência de revisão e nova versão pendente.
O CI também executa 10.000 cenários de qualidade.
