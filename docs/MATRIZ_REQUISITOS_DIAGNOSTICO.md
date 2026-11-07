# AXE Fomento — requisitos e diagnóstico por projeto (AF-013 / AF-014)

05/11/2026. Implementação para desenvolvimento e testes automatizados, sem GO de produção.

## Escopo
A matriz é alimentada manualmente por administrador municipal, em cada oportunidade vinculada
a um projeto. Cada requisito registra:
- redação do requisito e caráter obrigatório declarado;
- URL HTTPS da fonte indicada (não verificada automaticamente);
- versão ou retificação declarada, item/seção e trecho da evidência;
- usuário responsável pela inclusão e data de registro.

A matriz é específica do município. Duas prefeituras com a mesma oportunidade global não
compartilham o documento cadastrado. A versão é um atributo textual e não uma garantia de
autenticidade ou vigência. O sistema **não preenche automaticamente regras jurídicas**.

A equipe municipal registra por projeto três estados:
- `atendido`: afirmação da equipe com campo de evidência/justificativa preenchido;
- `nao_atendido`: afirmação da equipe com justificativa preenchida;
- `pendente`: ainda não comprovado, inclusive quando não há avaliação.

O sistema apresenta **contagens descritivas**, não nota numérica, parecer jurídico, certificação
de elegibilidade, nem classificação definitiva. A justificativa ainda requer revisão humana.

## Segurança e persistência
- Migração nova `sql/008_requirement_evidence.sql`; nunca alterar migrações históricas.
- Policies RLS em requisitos, diagnósticos e eventos.
- Banco vincula requisito e projeto à mesma prefeitura **e mesma oportunidade** por FK composta.
- A inclusão de regra é restrita ao papel `admin`, com campos validados no servidor.
- Diagnósticos podem ser registrados por usuário municipal autenticado.
- SQL da avaliação registra estado e evento de auditoria atomicamente; repetição idêntica
  não cria evento novo.
- APIs rejeitam IDs inválidos, campos adicionais e origem não confiável.
- Evidência por URL externa fica rotulada como *fonte indicada não verificada*.
- Não há link de publicação automática em editais nem modificação do radar de captação.

## Manual de teste e critérios de aceite
Acesse a ficha de um projeto em **Meus projetos** e escolha **Matriz de requisitos**.
Administradores podem cadastrar regras para a oportunidade vinculada; usuários autenticados
do mesmo município podem registrar diagnóstico.

A integração testa duas prefeituras e dois projetos com oportunidades diferentes. Verifica
origem maliciosa, tentativa cruzada, evidência ausente, estado sem avaliação, RLS, repetição
idempotente e trilha de eventos. Confirma também que dados fictícios permanecem sinalizados.

## Pendências para homologação real
1. Validar origem, edição e trecho de cada edital antes de transcrever regras.
2. Definir processo de revisão institucional das evidências e revisões de requisitos.
3. Definir como tratar substituições/retificações de requisitos já avaliados (nova regra ou
   controle de obsolescência em fase posterior).
4. Homologar em servidor definitivo e aprovar a issue #13, preservando **NO-GO** até lá.
