# AF-033 — cinco frentes de implementação coordenadas

O trabalho foi organizado em cinco frentes especializadas
no mesmo fluxo. Não significa que cinco serviços de produção
ou cinco agentes independentes tenham sido executados em paralelo.

| Frente | Entrega |
|---|---|
| 1. Dados e versões | Migração 026, FK exata e RLS |
| 2. Regras de aprovação | Dupla responsabilidade, bloqueio de campos pendentes e revisão por versão |
| 3. API e segurança | POST autenticado, CSRF, Zod estrito, conflito de revisão |
| 4. UX e auditoria | Formulário do revisor, estado por versão, histórico imutável |
| 5. Qualidade e DevOps | Testes unitários, integração PostgreSQL, 10.000 casos e CI |

Todos os itens dependem de CI verde para validação técnica.
A homologação jurídica/operacional permanece separada.
