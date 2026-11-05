# AXE Fomento — AF-019: agenda de validade documental

05/11/2026. Implementação para desenvolvimento e homologação. **Sem GO de produção.**

## Entrega funcional

A página **/documentos/validade** apresenta os documentos dos projetos municipais
com data de validade informada pela equipe. A tela mostra projeto, documento,
data, estado, dias restantes ou dias vencidos, responsável pela renovação e
justificativa da origem da data. Filtros: vencidos; vencidos + próximos 7, 30 ou
90 dias; todos com validade. O menu lateral e a ficha de documentos do projeto
apontam para a agenda.

Na ficha **/projetos/[id]/documentos** cada documento tem formulário para
registrar uma data, selecionar **usuário ativo do mesmo município** como
responsável e justificar a fonte do prazo (10–500 caracteres). A edição,
transferência de responsabilidade e remoção explícita da validade geram
eventos de auditoria. Repetir o mesmo conteúdo não gera novo evento.

**Importante:** não são feitos cálculo jurídico de vigência, leitura de data do
arquivo PDF nem renovação automática. A ausência de data é apresentada como
*sem validade informada*, nunca como documento válido. A agenda é consultiva
dentro do sistema; **não envia e-mail, SMS ou notificações push**.

## Regras de prazo

As contas usam dias civis em `America/Sao_Paulo`. Uma data passada significa
vencido; hoje até +7 dias é alerta de 7 dias; até +30, alerta de 30; até +90,
alerta de 90 dias; datas mais distantes são classificadas como em dia.
O filtro de 7, 30 ou 90 dias também inclui os documentos já vencidos.
Os limites são inclusivos. O filtro padrão é 30 dias.

Só as primeiras 500 datas registradas, ordenadas pelo vencimento, são lidas
na agenda. Se esse limite for atingido, a interface alerta que a listagem
pode estar incompleta. A agenda não é um relatório exaustivo em escala.

## Proteção e persistência

- Migração **013_document_validity.sql** estende os registros do checklist com
  data, responsável, nota de evidência e ator da atualização, com constraints
  e chaves estrangeiras compostas para o mesmo município.
- Nova tabela de eventos com `FORCE RLS`, vínculo ao item/projeto/município
  e ator autenticado, e privilégios mínimos da role `fomento_app`.
- API `PATCH /api/projects/document-validity` verifica sessão, origem,
  documento, município, data real, responsável ativo e justificativa.
- A atualização do item e a inclusão no histórico ocorrem **na mesma
  transação PostgreSQL**. Um registro não pode apontar para conta de outra
  prefeitura nem aceitar responsável inativo.
- A retirada da data exige todos os campos nulos/vazios para não deixar
  um estado contraditório; o histórico permanece.
- A desativação posterior do responsável não apaga a atribuição:
  a interface sinaliza **conta inativa: reatribuir**.

## Dez frentes técnicas deste ciclo

1. Estrutura de dados e constraints.
2. Auditoria imutável por evento de alteração.
3. Cálculo determinístico de dias e faixas.
4. Endpoints HTTP e validação estrita.
5. Componente de edição responsivo.
6. Integração na ficha do projeto.
7. Agenda municipal e filtros.
8. Segurança: RLS, CSRF e referências municipais.
9. Testes unitários/integrados e regressão no CI.
10. Documentação, orientação de operação e critérios de aceite.

Essas são frentes de implementação e revisão técnica, não 10 profissionais
externos executando tarefas independentemente.

## Validação e pendências

As suítes `tests/document-validity.test.mjs` e
`tests/integration/document-expiry.test.mjs` devem comprovar datas reais,
limites exatos, fuso de Brasília, isolamento de duas prefeituras, responsável
ativo, acesso indevido, idempotência, trilha histórica e reatribuição.

Antes de GO, ainda são necessários monitoramento e volume de dados no servidor
alvo, políticas de responsáveis, métricas de entregabilidade de alertas se
futuramente incluídos, proteção de dados e aceite institucional na issue #13.
