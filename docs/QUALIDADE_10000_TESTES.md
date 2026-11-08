# AXE Fomento — bateria adicional de 10.000 casos de teste

## Execução

Com a aplicação Next.js e banco PostgreSQL **descartáveis** de CI configurados e a
role \`fomento_app\` já provisionada, executar:

\`\`\`sh
node scripts/quality-10000.mjs
\`\`\`

O CI executa esta etapa após os testes unitários, integração e privilégios. Uma
falha encerra o processo com código de saída diferente de zero, informa o vetor
e a categoria e impede aprovação do pipeline.

## Matriz de 10.000 cenários determinísticos

| Grupo | Casos | Validação |
| --- | ---: | --- |
| Valores financeiros aceitos | 1.600 | Conversão exata BRL→centavos e exibição |
| Valores financeiros rejeitados | 800 | Negativos, expoentes, separadores indevidos e limites |
| Quantidades aceitas | 1.600 | Armazenamento/exibição em milésimos e vírgula/ponto |
| Quantidades rejeitadas | 800 | Precisão excessiva, formato ambíguo e zero |
| Arredondamento de orçamento | 1.600 | Meios centavos, composição quantidade×preço e BigInt |
| Simulação de contrapartida AF-026 | 1.600 | Percentuais, divisão, aporte, saldo, déficit/superávit |
| Validade de datas | 500 | Calendário gregoriano, data impossível, diferenças |
| PostgreSQL — cálculos reais | 500 | Coluna gerada, valores, totais sem arredondamento flutuante |
| PostgreSQL — isolamento municipal | 500 | Cada registro visível no próprio tenant, oculto ao outro |
| HTTP — segurança da API | 500 | CSRF, sessão ausente, datas/precisão inválidas e outro tenant |
| **Total adicional** | **10.000** | Falha se uma categoria não atingir a cota |

A suíte usa PRNG xorshift32 com **semente fixa** \`0x20261106\`, para
reproduzir exatamente os vetores matemáticos. IDs de prefeituras e usuários
sintéticos são aleatórios para evitar colisões com outras execuções. Há
limite de 8 requisições HTTP simultâneas; **não** são 10.000 usuários
simultâneos nem um teste de carga de 10.000 chamadas SIP ou transações.

Os 500 casos de PostgreSQL usam linhas reais nas tabelas AF-025 de uma
prefeitura fictícia criada para o teste. Há mais 500 verificações de
visibilidade desses registros através da role web com contexto municipal
válido e estrangeiro. As 500 requisições HTTP são negativas por desenho:
não podem alterar dados. O script valida a ausência de mutações e tenta
limpar os dados de teste, mesmo em caso de falha.

## Restrições

- Nunca executar em ambiente de produção: o script insere dados sintéticos
  e exige \`RUN_TEST_DB_ISOLATION=yes\`, \`DATABASE_ADMIN_URL\`,
  \`DATABASE_URL\` e \`TEST_BASE_URL\`.
- A suíte não substitui testes de interface em navegadores reais,
  testes de desempenho sob 10.000 usuários simultâneos, pentest
  independente ou homologação municipal.
- Os resultados da bateria adicional devem ser contabilizados
  separadamente da quantidade de testes pré-existentes no Node Test Runner.
