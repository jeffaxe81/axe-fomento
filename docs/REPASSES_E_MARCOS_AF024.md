# AF-024 — Gestão de repasses e marcos previstos/realizados

## 7 frentes de trabalho concluídas em código
1. **PostgreSQL:** migração `019_financial_milestones.sql` com tabelas de
   cronograma e eventos, integridade e chaves compostas.
2. **Dinheiro sem ponto flutuante:** valores digitados como reais e centavos são
   convertidos para string inteira em centavos usando BigInt, sem arredondamento.
3. **API de previsão:** `POST /api/projects/financial-milestones`.
4. **API de realização:** `PATCH /api/projects/financial-milestones/realize`,
   exigindo comprovante privado da mesma candidatura.
5. **Interface:** `/projetos/[id]/financeiro`, com totais declarados, campos de
   lançamento e histórico de versões e de justificativas.
6. **Segurança:** titular/administrador municipal ativos, anti-CSRF, RLS forçada,
   revisão otimista, FK do protocolo e FK da prova no mesmo município/projeto.
7. **Qualidade:** testes de valores, isolamentos e trilha; migração repetível,
   permissões mínimas, CI e documentação operacional.

## Fluxo
Após a autorização interna (AF-021) e o protocolo externo (AF-022), o
administrador ou titular registra um **repasse** (com valor positivo) ou
**marco** (pode ter R$ 0,00), com data, valor e premissas informados.
O mesmo usuário autorizado registra a realização, anexando referência à
versão privada do comprovante (AF-018), com data, valor, motivo e hash SHA-256
copiado do registro de arquivo. Não substitui o arquivo nem sobrescreve a
previsão; cria evento de revisão 2. Não edita lançamentos realizados.

## Regras financeiras
- Valores de entrada aceitam `12345,67` ou `12345.67`, não aceitam
  separador de milhar ou notação exponencial; máximo 12 dígitos inteiros.
- Armazenamento em BIGINT, como centavos, sem Float/Double.
- A soma na interface reflete **apenas** os repasses presentes na consulta
  limitada aos primeiros 200 registros; marcos a R$ 0,00 não adicionam valores.
- Datas são civis (fuso de referência America/Sao_Paulo), e realização não
  pode ser registrada com data futura.
- O saldo pendente é a soma dos valores previstos de repasses ainda em
  status previsto, não equivale à diferença entre total contratado e depósito.
- Valores realizados podem diferir dos previstos; a diferença aparece na ficha.

## Segurança e privacidade
- FORCE RLS em duas tabelas e verificação do ator a partir de sessão válida.
- Gravações transacionais auditadas; role de app não tem UPDATE/DELETE nos eventos.
- Comprovante imutável usa FK composta de município, projeto, item, versão
  e SHA-256; a API não aceita hash arbitrário como parâmetro.
- Links de download são autenticados pelas rotas existentes do AF-018.
- Sem comparação bancária ou API de órgãos; todos os valores são declarados.

## Ativação
`ENABLE_FINANCIAL_TRACKING=no` por padrão. O CI usa `yes` com base descartável.
Só considerar ativação após aceite operacional da issue #13, políticas de
privacidade, recuperação de chave, antivírus/quarentena do AF-018, validação
municipal das premissas financeiras e homologação do AF-022.

## Critérios de aceite
- Sem protocolo previamente declarado, não se cadastra um repasse.
- Repasse exige valor positivo; marco admite valor nulo; valores monetários
  são exatos em centavos.
- Titular/administrador registra previsão e realização; outro usuário
  ou outra prefeitura recebe 404.
- Uma prova de outro município/projeto não é associável ao lançamento.
- Resposta repetida ou concorrente não duplica o histórico.
- A trilha é append-only para fomento_app.
- Interface exibe valor e data previstos e realizados, diferença, fonte
  informada, autoria, protocolo e prova exata (quando download habilitado).
