# AXE Fomento — AF-037 a AF-040 · meta de 80%

## Entregas

**AF-037:** radar municipal de chamadas/referências internacionais,
com idioma, instituição, abrangência, modalidade, URL, data da
consulta declarada e status documental. O registro não prova
que um edital está aberto, financiado ou disponível para
o município. Fonte pública deve ser reconferida pelo operador.

**AF-038:** rota de candidatura direta/intermediada/a confirmar
por referência, contato institucional, URL de origem e etapas.
Contatos são informados ou declarados conferidos pela equipe;
não há endosso automático do financiador.

**AF-039:** consórcio criado por administrador municipal, convite
para outra prefeitura e **aceite bilateral**, sempre por
administrador ativo do destino. Nenhum convite concede acesso
à carteira. Revogação de membro cria evento com revisão e
retira direitos derivados. Diretório de municípios expõe
somente nome, UF e identificador a administrador ativo.

**AF-040:** resumo livre escrito especificamente pelo gestor
autorizado do projeto, sem copiar texto do projeto privado
automaticamente. Admin de município participante com adesão
ativa tem acesso à tabela reduzida de resumos autorizados.
Projeto completo e anexos permanecem sob RLS do município
de origem. Revogar resumo ou adesão impede novas leituras
inclusive por URL direta. Cópias prévias já exportadas
não podem ser revogadas retroativamente.

## Segurança

- PostgreSQL com migrações 030–033: RLS obrigatório,
  chaves compostas, eventos append-only e grants
  UPDATE limitados às colunas de status/revisão.
- API com sessão, CSRF, Zod estrito, permissão de
  administrador ou gestor conforme o caso e SQL parametrizado.
- Os municípios convidados precisam manifestar aceite
  antes de visualizar qualquer resumo.
- Nenhum acesso automático aos projetos, anexos,
  gravações, finanças ou informações de outros tenants.
- O módulo não envia candidaturas a fontes externas.
- Testes verificam URL direta antes/depois da adesão e
  depois da revogação, além de concorrência e papel de usuário.

## Operação

- `ENABLE_INTERNATIONAL_COOPERATION=no`
- `ENABLE_CONSORTIUMS=no`
- `ENABLE_CONSORTIUM_SHARING=no`

Habilitação de escrita apenas em CI descartável até
a homologação institucional, jurídica e operacional da issue #13.
Atingir 40/50 = 80% mede incremento funcional codificado
e testado; não indica prontidão para produção.
