# AF-032 — 10 frentes de revisão técnica coordenadas

As 10 frentes representam especialidades de análise executadas
em um mesmo fluxo de desenvolvimento; **não** representam dez
agentes autônomos efetivamente acionados em paralelo.

| Frente | Foco | Componente |
|---|---|---|
| 1. Produto | Modelo de proposta e restrições | RASCUNHO_PROPOSTA_AF032.md |
| 2. Arquitetura | Snapshot e geração local determinística | lib/proposal-draft.mjs |
| 3. Dados | Projeto, prefeitura, etapas e custos | READ_PROPOSAL_SOURCE_SQL |
| 4. Evidências | Requisitos e revisões AF-030 | READ_PROPOSAL_SOURCE_SQL |
| 5. Segurança | CSRF, sessão, autorização e limites | rotas POST |
| 6. Banco | FORCE RLS, FK e imutabilidade | sql/025_proposal_drafts.sql |
| 7. Backend | Geração e controle otimista | lib/proposal-sql.mjs |
| 8. UX | Formulário e histórico de versões | /projetos/[id]/proposta |
| 9. Qualidade | Unitários e integração com 2 tenants | testes AF-032 |
| 10. DevOps | Flag, 10.000 casos e CI | .github/workflows/ci.yml |

Conclusão depende de CI integral verde e não substitui a
homologação operacional da issue #13.
