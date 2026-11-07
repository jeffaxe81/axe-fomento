# AF-031 — Plano integrado de 10 frentes especializadas

Estas são **dez perspectivas técnicas de revisão**, coordenadas no
mesmo desenvolvimento; não representam contratação de pessoas ou
execução independente de dez agentes externos.

| Frente | Foco | Verificação / entrega |
|---|---|---|
| 1. Arquitetura | Reusar PostgreSQL e Next.js | `lib/semantic-catalog.ts` sem nova infraestrutura |
| 2. Linguagem natural | Intenções/sinônimos locais e português | `lib/semantic-intent.mjs` e testes unitários |
| 3. Dados | Separar oportunidades de programas | SQL e UI por `tipo`, nunca union de editais não abertos |
| 4. Curadoria | Mostrar apenas fontes municipais aprovadas | `review_state='approved'`, última observação/versão |
| 5. Backend | API autenticada parametrizada | `/api/opportunities/semantic` com GET limitado |
| 6. Frontend | Interface acessível e navegação | `/oportunidades/semantica`, radar, sidebar |
| 7. Segurança | Controle de sessão, input, sem SQL dinâmico | Testes HTTP e `cache-control: no-store` |
| 8. Multi-tenant | FORCE RLS da fonte municipal | Duas prefeituras, nenhum programa cruzado |
| 9. Qualidade/performance | Índices GIN, ordenação global, paginação | Migração 024, testes de item antigo e 10.000 cenários |
| 10. Documentação/DevOps | Premissas, limitações, CI e flag | Este plano, manual e PR com testes |

## Critérios de aceite

1. Consulta por objetivo encontra sinônimos previstos no dicionário.
2. Fontes em revisão, rejeitadas ou de outros municípios não aparecem.
3. Nenhum programa de fonte é tratado como oportunidade aberta.
4. A origem e a data são exibidas com precisão do que o banco possui,
   sem presumir data de consulta não armazenada.
5. A query do usuário não modifica a estrutura SQL nem contorna sessão.
6. Paginação funciona após o ranking do catálogo integral.
7. Testes automatizados e CI completo devem passar antes de registrar
   a entrega como tecnicamente validada.
8. Sem merge na main e sem produção antes de aprovação operacional #13.
