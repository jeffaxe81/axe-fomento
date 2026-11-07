# AF-041–AF-050 · Escopo codificado (50/50) e portões de validação
Data: 07/11/2026 · Branch `feat/backlog-50-carteira-municipal` · PR #24 (rascunho).

## Entregas adicionais
| ID | Funcionalidade | Evidência no código |
| --- | --- | --- |
| AF-041 | Conversão por fonte e modalidade | `/relatorios/conversao`, coortes deduplicadas por projeto/portal/modalidade, percentual explícito |
| AF-042 | Cadastro de ideia | `/avaliador`, `/api/readiness/cases`, problema, público e objetivo sem projeto formal |
| AF-043 | Projeto documentado | Ficha do avaliador e `/api/readiness/evidence` vinculam ID de versão e SHA-256 do anexo pertencente ao mesmo município e projeto |
| AF-044 | Rubrica ponderada e versionada | `/api/readiness/rubrics`, critérios validam soma 100, versões imutáveis, snapshot na avaliação |
| AF-045 | Pontuação determinística | `lib/readiness-rubric.mjs`, `lib/readiness-policy.mjs`; ausência de evidência não melhora a nota |
| AF-046 | Impedimentos separados | Códigos controlados e justificativa textual humana, não anulados por nota alta |
| AF-047 | Plano de correção | Plano determinístico priorizado e histórico append-only de atribuições responsáveis |
| AF-048 | Simulação de melhorias | Componente cliente altera notas projetadas sem gravar no banco |
| AF-049 | Revisão e reavaliação | Avaliações encadeadas por `previous_id`, revisão administrativa separada da autoria e trilha imutável |
| AF-050 | PDF pré-viabilidade | Rota autorizada `/api/readiness/cases/[caseId]/report`, com rubrica, versão, fonte, SHA-256, impedimentos, decisões e plano |

## Segurança e aderência
- Migração aditiva `035_readiness_evaluator.sql`, **35 migrações** até este incremento.
- FORCE RLS, chaves compostas de município/projeto, SQL parametrizado, validação estrita Zod, CSRF e role web sem UPDATE/DELETE nas novas tabelas.
- Edição não sobrescreve avaliação, documento, rubrica, revisão ou atribuição.
- Feature flag `ENABLE_READINESS_EVALUATOR=no` por padrão; CI ativa somente no banco descartável.
- O PDF é relatório privado de **alegações internas**, sem certificação legal, financeira, de crédito ou de protocolo.
- A conversão AF-041 usa a situação atual dos projetos; não reconstitui a situação histórica no período.

## Critérios para concluir a meta
O escopo está **codificado em 50/50 funcionalidades**. Apenas declarar **100% do backlog implementado e testado** quando o **CI do commit final** concluir com sucesso, inclusive integração com duas prefeituras, migrações repetíveis, build, testes de role, qualidade e restauração. Publicação operacional continua **NO-GO** até homologação de todos os portões OP-01 a OP-08 em `docs/HOMOLOGACAO_OPERACIONAL.md` e encerramento da issue #13. Sem merge automático enquanto o PR estiver em rascunho.

## Limites conhecidos
- O avaliador não consulta automaticamente editais, sistemas bancários ou órgãos externos, nem substitui parecer técnico.
- Nenhuma nota percentual de execução do projeto do município ou indicação de impedimento garante acesso a financiamento.
- A simulação não altera snapshots registrados e exige reavaliação humana para se tornar evidência.
- A homologação real depende de usuários, dados, domínio, HTTPS, logs, backup/restore e aceite operacional.
