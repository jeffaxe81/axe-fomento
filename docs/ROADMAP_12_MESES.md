# AXE Fomento — planejamento antecipado de 12 meses

Este documento antecipa o planejamento, não declara entregas concluídas.

## Ordem de execução

1. **Bloqueadores de segurança:** executar CI completo; confirmar RLS com role restrita e credenciais separadas; testar login, sessões, MFA, recuperação de senha, auditoria e limites de tentativas.
2. **MVP municipal:** concluir cadastros de prefeituras, projetos, fontes, avaliações e permissões; testar fluxo ponta a ponta.
3. **Oportunidades:** catálogo com fonte, data de publicação, prazo e situação; dados fictícios sempre identificados; nunca apresentar editais não verificados como reais.
4. **Aderência:** critérios transparentes e explicáveis; registrar versão de cada regra e evidência documental.
5. **Gestão:** documentos, calendário de prazos, alertas e acompanhamento de submissões.
6. **Relatórios:** indicadores por prefeitura, exportação e histórico de alterações.
7. **IA assistiva:** sugerir oportunidades e resumir requisitos com fontes; decisão final sempre humana.
8. **Operação:** backup e restauração testados, monitoramento, desempenho, acessibilidade e LGPD.

## Critérios para considerar concluído

Cada entrega exige: código versionado, testes unitários e integração aprovados, verificação de isolamento entre prefeituras, evidência de CI, documentação e homologação. Nenhuma falha crítica de segurança aberta. O percentual só aumenta com critérios de aceite comprovados.

## Status de referência

Último percentual informado: 2 de 8 critérios de aceite da Fase 1 (25%). Revalidar o CI e o PR antes de alterar o indicador. Produção bloqueada até homologação.
