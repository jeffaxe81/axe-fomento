# AXE Fomento — AF-025: Orçamento físico-financeiro

## Finalidade e escopo
A equipe municipal organiza o planejamento financeiro de um projeto em
**etapas de execução** e **itens físicos**. Cada etapa documenta período e
premissas; cada item documenta descrição, unidade, quantidade, preço
unitário e método/fonte de estimativa. Os cálculos são reproduzíveis,
mas os dados são **declarados**. Não há cotação oficial, desembolso,
empenho, integração bancária, verificação de fornecedor ou homologação.

## Sete frentes de implementação
1. Modelagem PostgreSQL: tabelas de etapas, itens, eventos, chaves compostas.
2. Cálculo financeiro exato: quantidade em milésimos; preço em centavos;
   cálculo unitário em `numeric` no banco e `BigInt` na validação web.
3. API de etapas: registro de cronograma, número, período, premissas.
4. API de itens: unidade, quantidade, preço e fonte declarada.
5. Interface de cadastro e quadro físico-financeiro por projeto.
6. Segurança: anti-CSRF, sessão e ator verificados, role mínima,
   FORCE RLS, sem UPDATE/DELETE na role web e bloqueio entre municípios.
7. Testes e operação: migrador, repetibilidade, build, testes, backup/restore,
   documentação e chave de ativação desligada até homologação.

## Cálculo e arredondamento
- `quantity_milli`: inteiro que representa milésimos de unidade.
  Exemplo: `1,500` vira 1500.
- `unit_cost_cents`: inteiro que representa centavos de reais.
  Exemplo: `R$ 10,01` vira 1001.
- `line_total_cents` é coluna **gerada no PostgreSQL**:
  `floor((quantity_milli * unit_cost_cents + 500) / 1000)`.
  Para quantidade positiva e preço não negativo, arredonda metade para cima.
  Exemplo: 1,500 × R$ 10,01 = R$ 15,015, arredondado a **R$ 15,02**.
- Subtotal da etapa = `SUM(line_total_cents)` de todos os itens da etapa.
- Total geral = `SUM(line_total_cents)` de todos os itens do projeto.
- Conferência da interface: total geral deve igualar a soma de todos os
  subtotais. Leituras concorrentes podem produzir diferença transitória;
  a interface orienta atualizar a página e verificar novos registros.
- Todas as somas são feitas em `numeric` no PostgreSQL, evitando
  overflow em `bigint` da agregação, e convertidas em `BigInt` no servidor.
- Quantidade: até seis dígitos inteiros, três decimais, maior que zero.
  Preço unitário: até 12 dígitos inteiros, dois decimais, não negativo.
  Valor por item até R$ 999.999.999.999,99 (limite técnico).
- Separadores de milhar não são aceitos no formulário.
- Etapa tem número 1–200; item tem número 1–9999 dentro da etapa.
  Duplicidades causam conflito 409 sem sobrescrever.
- Registro no MVP é append-only: sem botão para editar ou apagar itens.
  Correção posterior exigirá fluxo de versões e trilha de aprovação.

## Segurança, identidade e integridade
- O usuário deve estar autenticado e ser **titular do projeto** ou
  **administrador ativo do município**.
- Projeto de oportunidade fictícia/teste não permite cadastro financeiro.
- `municipality_id` vem somente da sessão. APIs rejeitam campos
  imprevistos, origens HTTP externas e IDs de etapas de outro projeto.
- FORCE RLS nas tabelas, FKs compostas garantem vínculo de
  município/projeto/etapa, e eventos têm autor, valor e premissas.
- A role `fomento_app` recebe apenas `SELECT,INSERT` nas novas tabelas.
- O número de etapas é finito (200). O quadro limita exibição a 400
  itens, mas totais incluem todos os registros.

## Uso e homologação
1. Criar projeto de carteira e atribuir responsável municipal.
2. Acessar `/projetos/[id]/orcamento`.
3. Criar etapa com número, título, início/fim e premissas.
4. Inserir itens com unidade, quantidade, preço unitário e fonte.
5. Verificar subtotal da etapa, total geral e o indicador de conferência.

Variável `ENABLE_PROJECT_BUDGET=no` por padrão. A CI usa `yes`
em ambiente descartável. Para produção, exigir aceite operacional da
issue #13 e revisão de privacidade, concorrência e critérios de
correção/versionamento, sem habilitar automaticamente.

## Critérios de aceite
- Etapas e itens somente no município/projeto próprios.
- Datas e unidade/quantidade/custo são validados; não existem
  números com mais de 3 casas de quantidade ou 2 de valor.
- Duplicata não altera o dado existente.
- Valores registrados são reproduzíveis em centavos por item e por etapa.
- Total geral reconcilia com soma dos subtotais de todas as etapas.
- Eventos e entidades sem UPDATE/DELETE para a role da aplicação.
- Testes com duas prefeituras, administradores, titulares e terceiros.

## Simulação de contrapartida — AF-026

Na tela do orçamento, informe o percentual municipal e o valor disponível em
reais. A simulação usa o total de todos os itens registrados no projeto. Os
campos aceitam vírgula ou ponto decimal e até duas casas.

O aporte é o total do projeto multiplicado pelo percentual, com meio centavo
arredondado para cima. A falta ou a sobra compara o disponível informado com
o aporte calculado. Em um projeto de R$ 100.000,00, uma contrapartida de
12,50% resulta em R$ 12.500,00 de aporte. Com R$ 10.000,00 disponíveis,
faltam R$ 2.500,00.

As premissas e o resultado ficam na página do navegador para análise da
equipe municipal. A homologação operacional segue na issue #13.

## Cenários de parcelas — AF-027

Abra **Simular parcelas** no orçamento do projeto. A página sugere o total
de todos os itens como principal e aceita outro valor informado em reais,
com até 12 dígitos inteiros e duas casas decimais.
A comparação usa o mesmo principal nos dois cenários. Cada cenário tem taxa
fixa de 0 a 100% ao mês, até quatro casas decimais, 1 a 360 meses de amortização
e 0 a 60 meses de carência. As premissas e os resultados ficam na página do
navegador para o planejamento da equipe.

O Sistema de Amortização Constante (SAC) divide o principal entre os meses de
amortização. Se a divisão em centavos tiver resto, as primeiras parcelas
recebem um centavo a mais até distribuir todo o principal. Os juros do mês
incidem sobre o saldo no início do mês e são arredondados ao centavo mais
próximo, com meio centavo para cima. Na carência anterior à amortização,
a simulação usa pagamentos mensais de juros calculados sobre o principal.
[Referência da CAIXA sobre o método SAC](https://caixanoticias.caixa.gov.br/Paginas/Not%C3%ADcias/2026/02-FEVEREIRO/SAC-ou-Price-entenda-as-diferen%C3%A7as-entre-os-sistemas-de-amortiza%C3%A7%C3%A3o-e-fa%C3%A7a-a-melhor-escolha.aspx)

| Principal | Taxa mensal | Amortização | Carência | Pagamentos em ordem | Juros totais | Total pago |
| --- | --- | --- | --- | --- | --- | --- |
| R$ 1.200,00 | 2% | 3 meses | 1 mês | R$ 24,00, R$ 424,00, R$ 416,00 e R$ 408,00 | R$ 72,00 | R$ 1.272,00 |
| R$ 1.200,00 | 1% | 4 meses | 0 meses | R$ 312,00, R$ 309,00, R$ 306,00 e R$ 303,00 | R$ 30,00 | R$ 1.230,00 |

A homologação operacional segue na issue #13.
