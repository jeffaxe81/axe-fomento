# AXE Fomento — AF-036 · Catálogo de referências COFIEX/PFE

## Referências públicas e objetivo

As oito fontes são páginas institucionais identificadas em
**7 de novembro de 2026**, acessíveis por links nas telas:

1. Comissão de Financiamentos Externos (MPO);
2. Portal de Financiamento Externo (PFE);
3. legislação e atos normativos consolidados;
4. reuniões COFIEX e Grupo Técnico;
5. calendário e pauta oficial das reuniões;
6. perguntas frequentes do MPO;
7. capacitações e treinamentos institucionais;
8. guia prático (notícia de lançamento de março de 2026).

A COFIEX examina e autoriza a preparação de projetos com apoio
financeiro externo do setor público nos casos abrangidos pela norma.
O PFE é o canal administrativo oficial para registro, análise,
autorização e acompanhamento de pleitos, e o encaminhamento
formal ocorre por representantes legalmente habilitados.

**A organização de fontes no AXE não constitui envio formal,
aprovação COFIEX, homologação jurídica ou elegibilidade.**

Consulte sempre a legislação atual, especialmente as retificações
e alterações publicadas em 2025–2026, antes de adotar prazos.
Datas dos calendários oficiais podem ser alteradas. O AXE não
calcula automaticamente prazo regulamentar de submissão;
a página oficial de reuniões prevalece.

## Telas

- `/cofiex`: oito fontes oficiais com classificação temática,
  título, descrição, URL e data de catalogação. A consulta
  requer sessão municipal, embora os dados sejam referências
  nacionais comuns.
- `/projetos/[id]/cofiex`: doze passos documentais
  como **roteiro interno**, com classificação, fonte e
  estado da última consulta humana por etapa.
- `/projetos/[id]/cofiex/[stage]`: histórico de eventos
  imutáveis, dados congelados e observação da equipe.
- Link "Consulta COFIEX" na ficha de cada projeto.

## Etapas representadas

1. Confirmar escopo do financiamento externo.
2. Consultar normas e alterações vigentes.
3. Consultar materiais de orientação.
4. Verificar requisitos e critérios oficiais.
5. Preparar acesso de representante no PFE.
6. Organizar preenchimento e validação no PFE.
7. Confirmar envio formal pelo responsável autorizado
   — **o AXE apenas registra nota interna**.
8. Acompanhar eventual reunião técnica do GTEC.
9. Consultar Pré-COFIEX e calendário atualizado.
10. Consultar deliberação formal da COFIEX.
11. Acompanhar negociação contratual quando cabível.
12. Acompanhar execução e orientações posteriores.

São descrições gerais do ciclo; certas fases podem não
se aplicar a um projeto. Não há avanço automático de
uma fase após a conclusão de outra.

## Segurança e proveniência

- Catálogos globais são carregados pela migração SQL,
  somente leitura para `fomento_app`.
- Eventos por projeto usam `municipality_id` com
  FK composta de projeto e autor, `FORCE RLS`,
  grants `SELECT,INSERT` apenas para a aplicação.
- Edição/destruição de eventos antigos fica proibida
  à credencial web.
- Autor é administrador ativo do município ou o titular
  ativo do projeto, confirmado novamente dentro da SQL.
- API `POST /api/projects/cofiex/checks` exige sessão,
  origem de confiança (CSRF), corpo estrito, estado
  controlado, data de consulta humana válida e ciência
  de limites de validade/efeitos administrativos.
- Uma nova observação cria nova revisão da etapa.
  `expectedRevision` e constraint UNIQUE protegem contra
  gravação concorrente; conflito provoca HTTP 409.
- Os eventos incluem código e URL oficiais como snapshot,
  nota, autor, timestamp e SHA-256 dos metadados; o hash
  **não** prova integridade do conteúdo do site do MPO.
- Recomendação de revisar consulta antiga após 90 dias
  não significa que determinada norma foi revogada.

## Riscos e limitações

- Fontes podem mudar, ficar indisponíveis ou receber
  retificações após 07/11/2026. Este catálogo não
  monitora alterações automaticamente.
- O Portal de Financiamento Externo (PFE) exige
  credenciais e autorizações próprias. O AXE não
  coleta credenciais do PFE, não faz automação de login
  e não integra protocolo oficial neste escopo.
- Não se informa prazo final, limite financeiro,
  elegibilidade ou status de deferimento em nome da COFIEX.
- Nenhum registro interno substitui o parecer técnico,
  o jurídico, o endosso do financiador, a avaliação do
  Tesouro, a autorização formal ou o processo do PFE.
- `ENABLE_COFIEX_CATALOG=no` por padrão e issue #13
  para homologação antes de produção.

## Testes

CI com PostgreSQL isolado, rotas autenticadas, testes de
duas prefeituras, referência e doze etapas, concorrência,
fonte imutável, projeto fictício, impedimento de acesso
entre tenants, eventos append-only e 10.000 casos gerais
de qualidade, além de build e backup/restauração.
