# AXE Fomento — AF-012 (CAPAG) e AF-017 (checklists)

05/11/2026. Trabalho em desenvolvimento no PR #24: **sem liberação para produção**.

## AF-012 — Indicador CAPAG documentado

O cadastro CAPAG integra a página **Perfil municipal**. Somente administradores municipais
podem incluir e atualizar dados, com classificação declarada, ano-base, data de referência
da publicação, edição indicada e URL HTTPS para a fonte oficial. O indicador é exibido a
todos os usuários do mesmo município. Ausência fica explícita, bem como referência com mais
de 366 dias. A interface sempre recomenda conferir se há publicação mais recente.

A aplicação **não consulta automaticamente** planilhas ou a Prévia Fiscal do Tesouro e
**não afirma que um registro digitado por administrador já tenha sido validado** pelo
Tesouro Nacional. O valor informado não autoriza financiamento nem garante elegibilidade
ou garantia da União.

Os dados abertos do Tesouro disponibilizam publicações com períodos e anos-base distintos.
Exemplo de fonte oficial de referência:
https://www.tesourotransparente.gov.br/temas/estados-e-municipios/capacidade-de-pagamento-capag

O banco limita links ao HTTPS de `gov.br` ou `tesourotransparente.gov.br`. Não faz
requisições para links cadastrados. Mudanças de valor, ano-base, referência, URL ou edição
criam uma nova versão; gravações idênticas não incrementam versão. Há histórico do autor
e da data da captura, protegido por RLS e FK de usuário do próprio município.

## AF-017 — Checklist por modalidade

Na ficha de cada projeto há um link para **Checklist documental**.
Um administrador cadastra manualmente documentos-modelo em uma das modalidades:
convênio, transferência, financiamento, cooperação ou outra.

A inicialização do checklist exige que existam modelos da modalidade; em uma transação,
o banco cria o checklist específico do projeto e copia título e orientações vigentes.
Um segundo comando para a mesma modalidade não duplica os documentos. A troca posterior
de modalidade é bloqueada, exigindo revisão humana antes de migração futura.
Modelos incluídos depois não são incorporados silenciosamente aos checklists já criados.

A equipe pode marcar cada documento como:
- **Pendente de comprovação** — estado inicial;
- **Apresentado (declarado)** — com anotação de evidência;
- **Dispensado (declarado)** — com justificativa obrigatória.

A interface conta os documentos por estado, mostra as orientações do modelo e registra
histórico das mudanças. Os estados são declarações da equipe. Não há upload de
arquivos nesta etapa: versionamento de anexos está previsto para AF-018.

## Integridade, segurança e limites

- Migrações novas `010_municipal_capag.sql` e `011_document_checklists.sql`,
  sem modificar migrações históricas.
- RLS com `FORCE` em todas as tabelas novas, transações vinculadas ao município,
  criação restrita a administrador e ator identificado na escrita.
- FKs compostas impedem usar modelo de outra prefeitura/modalidade e documento de outro projeto.
- Criação e atualização são idempotentes, com histórico de CAPAG e eventos de mudança de documento.
- Controles CSRF e validação estrita de entrada nas rotas de escrita.
- A matriz de elegibilidade AF-013/014 continua separada do checklist documental: nenhum
  requisito jurídico é inferido, nem há aprovação automática de candidatura.

## Aceite e operação

Validação automatizada em `tests/integration/capag-document-checklists.test.mjs`
exercita duas prefeituras, papéis de usuário, URLs rejeitadas, datas incompatíveis,
duplicações, versionamento, falta de modelo, mudanças de status, evidência obrigatória,
idempotência, RLS e proteção contra acesso cruzado.

Antes de liberar produção, conferir o contrato dos dados abertos, mapear importação oficial
e validar com municípios e área jurídica quais documentos são efetivamente exigidos.
A decisão **NO-GO** permanece na issue #13.
