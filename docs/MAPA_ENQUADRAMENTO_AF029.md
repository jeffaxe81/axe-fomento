# AXE Fomento — AF-029: Mapa preliminar de enquadramento

## Propósito

Permitir que a prefeitura documente, por projeto e modalidade, os pontos
a validar antes de encaminhar a análise de elegibilidade a profissionais
responsáveis. A aplicação **não verifica juridicamente** leis, regulamentos
ou editais nem conclui automaticamente que um projeto é elegível.

## Fluxo de uso

1. A equipe registra uma fonte normativa e suas versões no AF-028,
   após consultar a publicação original. Referências são **declaradas**.
2. Na ficha de projeto, a ação **Mapa de enquadramento** abre
   `/projetos/[id]/enquadramento`.
3. Titular do projeto ou administrador ativo seleciona uma modalidade,
   cadastra um ponto de verificação e escolhe a **versão exata** da norma
   (não apenas a referência genérica).
4. O sistema grava o critério e seu primeiro evento **pendente**, sem
   decisão automática, com autor e data em uma única transação.
5. O responsável seleciona uma das situações: pendente, atendido,
   não atendido ou não aplicável, **todas declaradas**, sempre registrando
   evidência/justificativa de pelo menos 10 caracteres.
6. Cada alteração cria evento imutável com revisão incrementada. Se o
   formulário foi aberto antes da revisão de outra pessoa, o servidor
   retorna HTTP 409, exigindo recarga e nova análise.
7. O detalhe do critério recupera seu histórico recente, versão normativa
   vinculada, trecho, referência e hash SHA-256 da declaração de origem.

## Estrutura e integridade

- `project_modality_checks`: projeto, município, modalidade, número
  de regra 1–200 por modalidade, critério, fonte e versão normativa
  exata, autor e data. A integridade composta evita vínculo com
  versão de outro município.
- `project_modality_review_events`: revisão 1–10.000, status, nota,
  autor, data. Nunca UPDATE nem DELETE pela role web.
- A aplicação não edita nem apaga critérios na versão inicial.
  Critérios incorretos devem ser escalados para revisão futura, com
  plano explícito de retificação auditável.
- As tabelas usam **FORCE RLS**, `municipality_id` da sessão verificada,
  `actor_id` da sessão e role `fomento_app` com **SELECT/INSERT apenas**.
- Cadastro e revisão passam por autorização SQL de administrador ativo ou
  titular do projeto. O backend rejeita identidade municipal fornecida
  no corpo JSON, dados inesperados e origem HTTP não autorizada.
- Registros de projeto associado a oportunidade fictícia não podem
  ser cadastrados/revisados.
- A UI apresenta até 400 versões normativas para seleção; cada projeto
  pode ter até 200 regras em cada uma das 5 modalidades. A tela de
  histórico mostra as 100 revisões mais recentes, sem apagá-las do banco.
- As referências normativas preservadas não são garantia de autenticidade,
  atualidade, aplicabilidade nem validação de fonte oficial.

## APIs e homologação

- `POST /api/projects/modality-map`: cadastro de critério associado
  a uma versão normativa. Respostas 201, 400, 401, 403, 404, 409 ou 503.
- `POST /api/projects/modality-map/review`: evento de revisão humana
  com `expectedRevision`. Retorna 409 para formulário desatualizado.
- `ENABLE_MODALITY_MAP=no` por padrão e `yes` no CI descartável.
  Não habilitar em produção sem aceite da issue #13 e avaliação jurídica.

## Critérios de aceite

- Critério de modalidade referencia versão normativa do mesmo município.
- Criação gera pendência sem decisão legal automática.
- Titular e administrador podem revisar; analista sem titularidade
  não pode escrever, mas visualiza mapa da sua prefeitura.
- Mesmo usuário não pode sobrescrever uma revisão mais recente.
- Histórico vincula versão imutável da fonte, ator, nota e data.
- Acesso e escrita entre prefeituras são negados.
- Rejeição de CSRF, campos inesperados, UUID e status inválidos.
- Migração repetível, 10.000 cenários existentes e verificações
  adicionais da funcionalidade aprovadas no CI.
