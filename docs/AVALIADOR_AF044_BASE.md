# AXE Fomento — núcleo determinístico do avaliador (preparação AF-044/045)

Implementado um motor puro de validação de rubrica e pontuação ponderada em `lib/readiness-rubric.mjs`, com testes de unidade em `tests/readiness-rubric.test.mjs`.

- Pesos inteiros positivos devem somar exatamente 100.
- Critérios possuem identificadores únicos e descrição validada.
- Nota por critério varia de 0 a 100 e exige texto de evidência.
- Critérios sem avaliação permanecem desconhecidos, não são considerados atendidos.
- O resultado apresenta pontuação conservadora, limite superior teórico, cobertura de pesos e detalhamento.
- A mesma entrada produz o mesmo resultado independentemente da ordem das avaliações.

**Limite:** esta entrega é somente o núcleo de cálculo, sem persistência, UI, revisão humana, versionamento de rubrica ou integração com projetos. Não conta AF-044 nem AF-045 como concluídos. Não certifica elegibilidade, viabilidade jurídica ou financiamento. Não altera flags nem autorização de produção.

Para concluir AF-044/045, integrar a rubrica versionada no PostgreSQL com RLS municipal, APIs com sessão/CSRF, interface e testes de integração de duas prefeituras. Seguir com AF-041 a AF-050 e homologação da issue #13.
