# AXE Fomento — AF-021: revisão técnica e autorização interna

06/11/2026. Funcionalidade de desenvolvimento no PR #24. **Sem autorização de produção**.

## Objetivo e fluxo

O projeto municipal mantém seu estado operacional próprio. A nova revisão interna é
um processo **separado** e não representa protocolo, envio a órgão concedente,
aprovação de edital ou conformidade jurídica.

1. **Enviar à revisão interna:** o responsável pelo projeto ou um administrador
   apresenta a candidatura com justificativa de 10–500 caracteres. A primeira
   submissão recebe a revisão 1.
2. **Revisão técnica:** um administrador municipal distinto do solicitante
   verifica os impedimentos documentais e operacionais e registra justificativa.
3. **Devolver para correções:** um administrador distinto do solicitante pode
   devolver uma proposta em revisão técnica ou já revisada. A decisão fica
   registrada. O solicitante poderá corrigir e reenviar a proposta.
4. **Autorizar internamente:** somente um **outro administrador**, diferente
   tanto do solicitante quanto do revisor técnico, pode autorizar a proposta
   cuja revisão técnica foi aprovada. A transição também verifica os impedimentos.
5. **Registro final:** a autorização é mantida como estado terminal desta rodada.
   A equipe ainda deverá realizar eventual submissão externa e registrar o protocolo
   em uma funcionalidade separada (AF-022).

Toda mudança efetiva gera um evento com número de revisão, autor, data civil
apresentada no fuso de Brasília, justificativa e estados anterior e posterior.
Revisões antigas são rejeitadas com **HTTP 409**.

## Regras automáticas de impedimento

A aprovação técnica e a autorização interna exigem simultaneamente:

- Checklist documental do projeto já inicializado;
- Nenhum documento marcado como `pendente`;
- Nenhuma tarefa municipal em `pendente` ou `em_andamento`;
- Nenhum requisito marcado como obrigatório na matriz do instrumento sem
  avaliação humana registrada como `atendido`.

Ausência de requisitos obrigatórios cadastrados **não equivale** a certidão de
elegibilidade. Exige revisão humana das condições oficiais do instrumento.
Marcar documento como apresentado ou dispensado também não substitui
conferência de sua autenticidade ou aceite institucional.

## Páginas e APIs

- `/revisoes`: fila de candidaturas; administradores veem as revisões do
  município, demais usuários veem as de seus projetos.
- `/projetos/[id]/revisao`: estado, impedimentos, decisões e histórico.
- `POST /api/projects/internal-review`: ações estritas `submit`,
  `technical_approve`, `return` e `authorize`. Corpo contém
  `projectId`, `expectedRevision` e `note` de 10–500 caracteres.

## Segurança

A migração incremental `015_internal_reviews.sql` cria uma tabela de estado
por projeto e uma tabela de eventos de revisão com `FORCE RLS`, referências
compostas município/projeto/usuário e separação obrigatória entre solicitante,
revisor técnico e autorizador. A aplicação tem permissão de **SELECT e INSERT**
na tabela de eventos, sem permissões de UPDATE ou DELETE. Transições de estado
e eventos são executados atomicamente em transações PostgreSQL, com bloqueio
concorrente e número de revisão otimista.

Somente contas ativas e administradores municipais podem revisar, devolver ou
autorizar. Uma conta não pode revisar a própria solicitação, nem autorizar a
revisão técnica que ela realizou. A versão inicial exige **três contas distintas**
quando o solicitante não for um administrador e o município ainda não tiver
outros revisores autorizados; é preciso preparar a governança local.

## Validação e limitações

A suíte `tests/integration/internal-project-review.test.mjs` verifica
contas e municípios distintos, falsificação de origem e papéis, devolução,
reenvio, impedimentos, transferência de decisão, autor independente, revisão
obsoleta, imutabilidade de eventos e ausência de envio externo.

Limitações: sem assinatura digital qualificada, sem envio a portais, sem
aprovação jurídica automática e sem congelamento criptográfico de todos os
artefatos de uma versão. Uma etapa futura deverá vincular os hashes/versões
exatas dos documentos aprovados e observar alterações posteriores à revisão.
A liberação operacional exige revisão independente, carga, acessibilidade,
política municipal de autoridades e homologação da issue #13.
