# AXE Fomento — AF-020: tarefas por secretaria e responsável

06/11/2026. Incremento de desenvolvimento na branch do PR #24, **sem GO de produção**.

## Resultado funcional

Uma conta de administrador municipal configura as secretarias em
**/administracao/secretarias**, adiciona usuários ativos ao grupo de integrantes
autorizados e pode revogar seus vínculos. Na criação da secretaria, o próprio
administrador torna-se integrante inicial. Uma pessoa pode pertencer a várias
secretarias, e cada associação mantém autoria e eventos de concessão/revogação.

Na ficha de cada projeto, **/projetos/[id]/tarefas**, administradores podem
atribuir uma tarefa à secretaria e a um integrante autorizado. A tarefa possui
título, orientação opcional, data de conclusão planejada, situação e número
de revisão. A pessoa designada pode atualizar o status; administradores podem
atualizar o status, trocar o responsável **dentro da mesma secretaria** ou
reprogramar o prazo. Toda mudança efetiva exige justificativa de 10–500
caracteres e gera um evento permanente com autoria, data e valores anteriores
e posteriores relevantes.

A central **/tarefas** apresenta inicialmente tarefas atribuídas à conta atual;
administradores podem selecionar todas as tarefas municipais. Mostra projetos,
secretarias, responsáveis, prazos e atraso. Não há envio automático de e-mails,
avisos push ou notificações. A conclusão é declaração da equipe, não evidência de
aprovação externa da candidatura.

## Segurança e concorrência

- Migração nova **014_municipal_tasks.sql**, mantendo intactas as treze anteriores.
- RLS forçada e FKs compostas entre tarefa, projeto, secretaria, integrante e
  usuários da mesma prefeitura; nenhum ID de município enviado pelo cliente é aceito.
- Secretaria e membros gerenciados apenas por administrador autenticado.
- Distribuição e transferência exigem conta **ativa** com vínculo **não revogado**
  à secretaria, no mesmo município.
- O responsável designado com vínculo ativo ou o administrador pode atualizar a
  situação. Transferência e reprogramação de prazo são administrativas.
- Exclusões físicas de tarefas e eventos não estão expostas nas APIs. O banco
  concede somente SELECT/INSERT para eventos, sem UPDATE/DELETE.
- Revisão otimista com contador de versão reduz sobreposição de alterações;
  uma versão antiga retorna HTTP **409**, exigindo atualização da página.
- Revogação de membro com tarefa aberta é recusada até transferência ou conclusão.
  Contas desativadas não podem receber novas tarefas.
- Eventos de criação, atualização de situação, transferência e prazo são inseridos
  na mesma transação do PostgreSQL. Operação repetida e idêntica não gera evento.

## Dez frentes coordenadas

1. Estrutura de dados e integridade relacional.
2. Cadastro de secretarias.
3. Associação e revogação de integrantes.
4. Distribuição inicial de tarefas.
5. Transferências rastreáveis de responsabilidade.
6. Controle de status e prazos.
7. Conflitos de edição e revisão otimista.
8. Interface responsiva e central de tarefas.
9. Testes negativos de isolamento, papéis e auditoria.
10. Pipeline CI, documentação e preparação operacional.

Estas são **frentes de trabalho técnicas**, não dez profissionais humanos
conectados ou agentes executando trabalho assíncrono.

## Critérios de aceite automatizados

- 2 municípios independentes com administradores e analistas.
- Acesso indevido entre municípios e usuário não associado bloqueados.
- Data inválida, corpo com campo estranho e origem externa rejeitados.
- Transferência exige membro ativo da mesma secretaria.
- Revisão stale retorna 409; mudança idêntica não altera histórico.
- Histórico vincula corretamente autor, antigo e novo responsável.
- Tentativa de revogar integrante com atividade aberta recebe 409.
- FKs e RLS recusam mudanças em registro de outra prefeitura.
- Resultados da suíte `tests/integration/municipal-task-distribution.test.mjs`
  devem ser verificados na execução específica do último commit.

## Limitações e próxima etapa

A gestão é de tarefas internas, sem integração com calendários de terceiros,
sem aceite eletrônico de responsabilidade e sem mudanças automáticas de secretaria.
A transferência entre secretarias e um workflow de revisão formal dependem de
escopo futuro. Listas mostram até 200 tarefas e até 300 alterações recentes por
projeto; podem ficar incompletas em municípios maiores.

Antes de produção: homologação municipal, análise de privacidade dos nomes,
revisão de desempenho, política de responsabilidade por secretaria e aprovação
formal da issue #13. Sem merge para a main e sem implantação.
