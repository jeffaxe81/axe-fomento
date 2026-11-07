# AXE Fomento — AF-028: base normativa versionada

## Propósito
Equipe municipal pode documentar referências normativas para apoiar
diagnósticos preliminares de elegibilidade e enquadramento. **Nenhum
registro é autenticação de lei, parecer jurídico ou validação automática
de vigência.** Datas e fontes são declaradas pelo responsável. É preciso
conferir o conteúdo original no órgão competente.

## Funcionamento
1. Administrador autenticado abre `/normativos`.
2. Registra código/título e jurisdição federal, estadual ou municipal.
   A UF municipal é preenchida a partir do município autenticado; a
   estadual exige informar a UF de referência; federal não tem UF.
3. Registra URL HTTPS pública, data de publicação, período informado,
   seção, trecho e justificativa. Cria referência e **versão 1** de
   maneira atômica.
4. A consulta `/normativos/[id]` apresenta as versões **mais recentes
   primeiro**, com links próprios, data, autoria, ID imutável e SHA-256
   do snapshot de metadados.
5. Novas versões são inseridas sem editar as anteriores e exigem
   `expectedVersion` atual. Duas revisões simultâneas não podem gerar
   o mesmo número: uma recebe conflito 409 e deve recarregar o histórico.

## Garantias
- As tabelas `municipal_normative_sources` e
  `municipal_normative_versions` usam FORCE RLS, FK composta e
  índices por `municipality_id`. O município é obtido da sessão.
- Apenas administradores ativos criam referências e versões.
- Usuários comuns do mesmo município podem consultar versões.
- A role `fomento_app` possui `SELECT,INSERT`, sem UPDATE ou DELETE,
  preservando versões históricas. Não se pode reclassificar dados
  existentes silenciosamente neste incremento.
- A URL é validada como HTTPS pública, sem usuário, senha, porta,
  consulta ou âncora, e nunca é acessada pelo servidor. O hash SHA-256
  serve como **impressão digital da declaração registrada**, não
  como assinatura ou autenticidade do texto legal externo.
- Campos de datas usam calendário civil. Publicação não pode ter data
  futura; início de vigência pode ser futuro; fim é opcional e não pode
  anteceder o início informado.
- Registro histórico preserva a fonte e o trecho exatamente associados
  a cada versão. A interpretação de período na UI é apenas informativa,
  não certidão de vigência legal.
- Limites: até 1.000 versões por referência. A listagem inicial mostra
  as 150 referências mais recentes, o histórico mostra até 1.000 versões.

## Operação e ambiente
- Migração `021_normative_sources.sql` aplicada com credencial
  administrativa, não da aplicação.
- Variável `ENABLE_NORMATIVE_REGISTRY=no` por padrão; habilitar somente
  após homologação operacional/jurídica (issue #13).
- CI descartável usa `yes`, valida interface, APIs, RLS, concorrência,
  migrações repetíveis e a bateria adicional de 10.000 casos.
- Sem consulta automática de portais ou decisão de elegibilidade.

## Critérios de aceite
- Código normativo não duplica no mesmo município.
- Versão contém fonte, jurisdição herdada da referência e datas.
- Consulta histórica recupera a referência exata de cada versão,
  sem depender da versão mais recente.
- Administrador de outro município não acessa referência alheia.
- Analista tem leitura permitida e escrita negada.
- Contratos HTTP rejeitam identidade municipal forjada, origem cruzada,
  URL privada/insegura e datas impossíveis.
- Role web não pode alterar/apagar versões.
- Versão defasada não cria novo registro.
