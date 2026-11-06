# AXE Fomento — AF-022: protocolo externo com comprovante versionado

06/11/2026. Incremento apenas na branch do PR #24. **Não habilitar em produção.**

## Objetivo

Após autorização interna da candidatura (AF-021), a equipe municipal pode
**registrar** um protocolo que ela declarou ter obtido em um portal externo.
O AXE Fomento não realiza a submissão, não consulta o portal, não verifica a
existência do protocolo e não certifica sua aceitação oficial.

Na ficha `/projetos/[id]/protocolos`, o responsável do projeto ou
administrador municipal registra o nome e URL do portal, número do protocolo,
data de submissão, justificativa e uma versão específica de comprovante
já armazenada no checklist documental do mesmo projeto.

O histórico apresenta esses dados, o responsável, a data de registro, a
revisão de autorização interna e o SHA-256 do arquivo utilizado como prova.
O arquivo pode ser recuperado pela rota autenticada da AF-018 enquanto
`ENABLE_DOCUMENT_UPLOADS=yes`. Nenhum arquivo é enviado a terceiros pelo
AXE Fomento. O estado do projeto continua inalterado: protocolo informado
**não significa** aprovação ou submissão automatizada.

## Dez frentes técnicas coordenadas

1. Modelagem SQL dos registros.
2. Vínculo relacional ao evento autorizado da AF-021.
3. Vínculo à versão imutável do comprovante e SHA-256.
4. Normalização e validação das URLs HTTPS dos portais.
5. Regra de data de submissão conforme calendário de Brasília.
6. API autenticada e proteção contra origem maliciosa.
7. Interface para registro e histórico dos protocolos.
8. Isolamento entre municípios e privilégio mínimo no PostgreSQL.
9. Testes de duplicidade, concorrência, permissões e prova estrangeira.
10. CI, documentação, critérios de aceite e bloqueio para produção.

Frentes técnicas de execução; não são dez profissionais ou processos
assíncronos conectados.

## Banco de dados e integridade

A migração `017_external_protocols.sql` é acrescentada depois das migrações
anteriores sem reescrever seus checksums. A tabela `project_external_protocols`
possui RLS forçada (`FORCE ROW LEVEL SECURITY`) e FKs compostas.

- `project_id` e `municipality_id` identificam unicamente o projeto municipal.
- `review_revision` aponta para um evento realmente do tipo
  `authorized`, exigindo a autorização interna pertinente.
- `proof_version_id`, `proof_item_id`, `proof_version` e
  `proof_sha256` formam uma FK que obriga a utilização da versão
  e do hash já gravados no projeto, nunca valores arbitrários do navegador.
- `portal_host` e `protocol_number` são únicos por município,
  reduzindo duplicidades; números repetidos recebem HTTP 409.
- `recorded_by` e `recorded_at` preservam identidade e data.
- A aplicação possui somente `SELECT` e `INSERT` na tabela de
  protocolos: sem alteração ou exclusão por endpoint e sem concessões
  `UPDATE` e `DELETE` à role web.

A consulta de autorização, prova e conta ativa é executada com a inserção
em uma única transação, sem aceitar `municipality_id` do cliente.
Só um administrador ativo ou o responsável do projeto pode cadastrar.

## Validação do portal e da data

São permitidas apenas URLs com HTTPS, domínio de DNS público sintaticamente
válido, sem usuário/senha, query string, fragmento ou porta personalizada.
IPs e nomes reservados como `localhost` e `.local` são recusados.
A URL é apenas **declarada pelo usuário**: sua propriedade, oficialidade,
atualidade ou segurança não são atestadas. O servidor **não faz fetch** do
endereço, prevenindo SSRF neste caminho.

A data deve existir no calendário, ser igual ou anterior ao dia atual em
`America/Sao_Paulo` e estar no intervalo suportado. Datas futuras e
31 de fevereiro, por exemplo, são rejeitadas. Este controle não garante
que a data declarada é a mesma do protocolo verdadeiro.

## Ativação operacional

`ENABLE_EXTERNAL_PROTOCOL_RECORDS=no` por padrão. O CI usa `yes`
somente no banco descartável. O upload da prova depende da AF-018, também
desligada por padrão até a análise de antivírus, quotas e política de
retenção. Um comprovante pode conter dados pessoais e sua distribuição deve
obedecer às regras municipais de acesso.

**Falta para homologação:** confirmação da fonte de protocolo, revisão de
autenticidade dos recibos, política de retificação de número digitado errado
sem apagar auditoria, eventual integração oficial com o portal e prova
criptográfica do conjunto exato de documentos submetidos.

Não ativar em produção até aceites de segurança, privacidade e operação
registrados na issue #13.

## Testes

- `tests/external-protocol.test.mjs`: URL HTTPS, credenciais, domínios
  reservados, porta, datas reais/futuras.
- `tests/integration/external-protocols.test.mjs`: duas prefeituras,
  prova criptografada e vínculo de versão/hash, protocolo vinculado a
  autorização AF-021, negação por papéis, prova de outro projeto,
  repetição e corrida de protocolo, origem forjada, RLS e imutabilidade.
- Pipeline completo de migrações, tipagem, build, PostgreSQL, Docker,
  backup/restore e auditoria de dependências.
