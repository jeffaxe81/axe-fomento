# AF-023 — Gestão municipal de diligências vinculadas a protocolos

## Objetivo e limite
Uma diligência é uma **declaração manual** da equipe da prefeitura sobre
solicitação recebida de um órgão. O AXE Fomento não consulta portais, não envia
resposta, não valida prazos e não certifica comprovantes externos.

## Fluxo
1. Registrar protocolo no AF-022; sem protocolo não há diligência.
2. Na ficha do projeto, abrir **Diligências**, escolher protocolo, responsável
   municipal ativo, título, orientação e prazo civil informado.
3. O responsável designado ou administrador registra a resposta (10–1500
   caracteres) e seleciona uma versão exata do comprovante privado AF-018.
4. A resposta passa a **respondida**, com autoria, data, revisão e SHA-256
   copiado diretamente do PostgreSQL. O registro não é editado novamente.

## Permissões e integridade
- Criar: administrador ou titular do projeto, autenticados e ativos.
- Responder: administrador ou responsável designado, ativos.
- A FK do protocolo exige mesmo município **e** projeto. A FK da versão da prova
  também exige o mesmo município e projeto.
- O banco usa FORCE RLS nas tabelas da diligência e de eventos. A role web pode
  selecionar/inserir eventos, mas não editar ou excluir a trilha.
- A resposta é gravada com revisão otimista, evitando sobrescrita concorrente;
  os eventos e o estado são atualizados atomically numa query.
- A API rejeita dados inesperados, UUIDs incorretos, datas inexistentes e
  requisições de origem não confiável.
- Os registros podem estar vencidos; o prazo continua sendo informação
  declarada, não a certidão de prazo do órgão.

## Implantação / homologação
`ENABLE_DILIGENCE_RECORDS=no` por padrão. Para testes isolados do CI, `yes`;
não ativar em produção enquanto AF-018/AF-022, antivírus, retenção, privacidade,
procedimentos de conferência e critérios da issue #13 não forem homologados.
Não liberar merge na main somente por passar em CI.

## Critério de aceite
- Cadastro exige protocolo existente e responsável ativo no mesmo município.
- Resposta exige comprovante imutável do mesmo projeto e preserva hash e versão.
- Administrador/titular e responsável possuem poderes separados.
- Corrida de revisão devolve 409, acesso cruzado devolve 404.
- Histórico não aceita UPDATE/DELETE por `fomento_app`.
- Fluxo navegável em `/projetos/[id]/diligencias`.
