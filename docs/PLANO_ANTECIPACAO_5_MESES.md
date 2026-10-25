# AXE Fomento — Plano de antecipação de cinco meses

**Objetivo:** trazer para execução imediata cinco ondas mensais de funcionalidades, sem declarar concluído o que ainda não foi implementado.

| Onda | Entregas prioritárias | Issues |
| --- | --- | --- |
| Mês 1 | Pesquisa e filtros; classificação de prazos; fontes verificáveis | #14, #15, #16 |
| Mês 2 | Fluxo de estados de projetos; histórico auditável | #17, #18 |
| Mês 3 | Anexos e documentos; alertas de vencimento | #19, #20 |
| Mês 4 | Indicadores municipais; exportação CSV segura | #21, #22 |
| Mês 5 | Testes caixa-preta, acessibilidade, estabilização e aceite | #23 |

## Critérios obrigatórios por entrega

1. Código funcional versionado e associado à issue.
2. Testes unitários, integração, segurança e isolamento municipal conforme o escopo.
3. CI aprovado para o commit relevante.
4. Documentação, evidências e revisão funcional.
5. Não fechar a issue nem anunciar 100% antes do aceite.

## Dependências e restrições

- Implantação e homologação em servidor definitivo: issue #13; não impede desenvolvimento local/CI.
- Editais fictícios sempre identificados; integração oficial requer fonte verificável.
- Dados municipais devem respeitar RLS, permissões e auditoria.
- Migrações e alterações de dados exigem plano de reversão.
- Sem publicação em produção antes do GO operacional.

## Estado inicial

- 10 issues funcionais registradas (#14–#23).
- Classificação de prazos possui módulo e testes iniciais, mas ainda requer integração à interface, CI e aceite.
- As demais ondas são planejamento, não entregas concluídas.

## Indicadores de acompanhamento

- Planejamento antecipado: 5/5 ondas descritas.
- Funcionalidades homologadas nesta antecipação: 0/10, até evidências de aceite.
- CI e homologação operacional são indicadores separados.
