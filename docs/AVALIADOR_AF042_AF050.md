# AXE Fomento — avaliador interno AF-042 a AF-050

## Contrato funcional

A ficha do projeto abre `/projetos/[id]/avaliador`. A API `POST /api/projects/readiness` suporta ações independentes: `idea` (AF-042, histórico), `rubric` (AF-044, pesos inteiros totalizam 100), `evidence` (AF-043, versão exata de documento ou item imutável de orçamento), `evaluate` (AF-045, nota determinística e lacunas), `assign` (AF-047, responsável ativo e histórico), `simulate` (AF-048, cenário sem gravação) e `review` (AF-049, revisor administrativo distinto do avaliador).

**AF-046:** impedimentos documentados permanecem separados da nota. Um bloqueio pode coexistir com nota alta; nenhum impeditivo ou parecer é inferido automaticamente. **AF-050:** `GET /api/projects/readiness/report/[evaluationId]` gera PDF em memória com a versão, critérios, fontes, responsáveis, SHA-256 do snapshot, impedimentos, plano e revisões. Exige sessão, RLS e flag.

A nota é conservadora: critério sem avaliação contribui zero e exibe o limite teórico se as lacunas fossem comprovadas. Reavaliação cria novo evento vinculado à versão anterior, sem substituir histórico. O snapshot guarda versões das fontes e critério escolhido. O histórico de autorias e atribuições é append-only para a role da aplicação.

## Segurança e limitações

- Migração SQL 035 cria 6 tabelas com `FORCE ROW LEVEL SECURITY`, FKs municipais e grants `SELECT/INSERT` (sem `UPDATE/DELETE` dos eventos).
- Sessão autenticada, origem protegida, Zod estrito, SQL parametrizado, usuário ativo e titular ou administrador para mutações de projeto. Rubrica e parecer só por administrador; parecer rejeita o próprio autor.
- `ENABLE_READINESS_EVALUATOR=no` por padrão. Habilitado apenas no CI de banco descartável.
- Não há IA inferindo elegibilidade, notas jurídicas nem capturas automáticas de normativos. Evidências, pesos, notas e impedimentos são entradas humanas e requerem conferência.
- Os relatórios são pré-viabilidade interna, não peça de licitação, laudo técnico, concessão de crédito ou despacho formal.
- Homologação jurídica e operacional no servidor definitivo permanece **NO-GO** na issue #13.

## Critérios de aceite em testes

Testar pontuação reprodutível (0-100), peso total=100, cenários desconhecidos, impedimentos separados da nota, no-write na simulação, revisões distintas, versões imutáveis, FKs de versão técnica/financeira, RLS de duas prefeituras, 403/404/409, PDF com várias páginas, restauração de backup e role sem UPDATE/DELETE em eventos.
