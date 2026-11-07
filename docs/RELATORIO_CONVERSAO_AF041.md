# AF-041 — conversão por fonte e modalidade

A página `/relatorios/conversao` calcula coortes a partir de protocolos manuais AF-022. Filtra data civil do protocolo, deduplica reapresentações por projeto, fonte e modalidade, e calcula `aprovados / protocolados`. Fonte = domínio de portal declarado; modalidade = checklist documental ou não informada. Os totais não equivalem a operações bancárias, dados da União nem certificação de resultados.

**Limite:** `projects.status` contém a situação atual, sem histórico para reconstruir a situação exata em uma data anterior. Logo, o período é o do protocolo e o desfecho reflete a situação no momento da consulta, não uma apuração histórica. Registro de origem e de modalidade pode ser incompleto.

Segurança: sessão obrigatória, PostgreSQL FORCE RLS municipal, SQL parametrizado, até 500 agrupamentos. A comprovação operacional fica na issue #13.
