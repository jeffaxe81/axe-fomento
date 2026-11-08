# AF-041 — Conversão por fonte e modalidade

A página `/relatorios/conversao` calcula coortes a partir de protocolos manuais AF-022. Filtra data civil do protocolo, deduplica reapresentações do mesmo projeto/fonte/modalidade e apresenta a razão `aprovados / protocolados`. A fonte é identificada pelo domínio do portal registrado; a modalidade vem do checklist documental. Projetos sem checklist entram em 'não informada'.

**Limitação histórica:** o campo `projects.status` registra apenas o estado atual; não há trilha integral para reconstruir aprovações anteriores à data de corte. O período seleciona a entrada na coorte (protocolo), e o desfecho é observado no presente. Não afirma consulta oficial, validação dos números ou estados históricos.

A consulta usa RLS por município, sessão verificada, SQL parametrizado, limite de 500 grupos; sem acesso entre prefeituras. Métrica preliminar para homologação.
