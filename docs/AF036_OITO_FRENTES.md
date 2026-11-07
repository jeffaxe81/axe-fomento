# AF-036 — oito frentes técnicas coordenadas

O desenvolvimento foi dividido em oito especialidades
com pontos de integração. Não se trata de oito agentes
independentes ou oito serviços implantados em paralelo.

| Frente | Entrega | Evidência |
|---|---|---|
| 1. Pesquisa oficial | Oito fontes MPO/COFIEX/PFE | SQL seed e manual |
| 2. Estrutura de dados | Tabelas de fontes, etapas e eventos | Migração 029 |
| 3. Fluxo documental | Doze etapas de consulta e orientação | Roteiro de projeto |
| 4. Segurança municipal | RLS, papéis, autorização, CSRF | API e grants |
| 5. API versionada | POST por etapa com controle de conflito | SQL e rota HTTP |
| 6. Interface de consulta | Catálogo, roteiro e histórico | Next.js |
| 7. Qualidade | Unitários, integração, corrida, duas prefeituras | CI |
| 8. DevOps e documentação | Flags, migrations, Docker, backup, auditoria | CI + docs |

Cada frente é considerada tecnicamente integrada somente
depois da execução integral do CI. A homologação
jurídica/operacional é distinta e permanece pendente.
