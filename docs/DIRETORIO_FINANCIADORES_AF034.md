# AXE Fomento — AF-034: diretório de financiadores nacionais

## Objetivo

Apoiar a pesquisa municipal por **instituições nacionais que
podem atuar em modalidades de fomento**, reunindo referências
declaradas pela equipe, com área, modalidade e trilha de consulta.

O catálogo **não** confirma linhas de financiamento ativas, recursos,
taxas, prazos, exigências, habilitação, prestação de contas, edital
aberto ou aprovação pela instituição. Uma referência institucional
não vira automaticamente uma oportunidade no radar.

## Utilização

1. Acesse `/financiadores` no menu principal.
2. Filtre por nome/código interno, modalidade ou área temática.
   A pesquisa de nome/código é literal (caracteres `%` e `_`
   são texto) e trabalha no catálogo inteiro antes de paginar.
3. Um administrador cadastra uma instituição, seleciona
   modalidades e temas, informa URL HTTPS pública, título da
   referência, seção, situação, data de consulta humana se
   realizada e nota explicativa.
4. Em `/financiadores/[id]`, a equipe consulta o histórico de
   versões. O administrador pode registrar nova conferência
   sem apagar ou reescrever o registro anterior.
5. "Consultada internamente" só pode ser marcada com data
   válida, anterior ou igual à data atual. É uma **declaração
   da equipe**, não uma verificação automática do sistema.
6. "Referência informada" e "Revisão necessária" não exigem
   data, e não devem ser confundidas com fonte auditada.

## Modelo de dados e trilha

- `municipal_financiers`: identificação e classificação
  imutável da instituição no escopo municipal.
- `municipal_financier_versions`: histórico append-only
  das referências. Cada versão registra autor, `recorded_at`,
  `checked_on` opcional, fonte, seção, nota e fingerprint SHA-256
  de **metadados informados**, não do conteúdo do site.
- Os links são normalizados como URLs públicas HTTPS, sem
  credenciais, query ou fragmento. O sistema não faz download
  nem solicita dados de endereços privados.
- Dados de cada município protegidos por `FORCE ROW LEVEL SECURITY`
  e privilégio mínimo do `fomento_app`, com apenas SELECT e INSERT.
- A criação de versão exige último número conhecido e gravação
  atômica; concorrência causa 409. Até 1000 versões por instituição.
- Só administradores podem cadastrar. Analistas autenticados
  podem consultar referências do seu município.
- A listagem usa até 25 itens por página; a consulta histórica
  exibe as últimas 100 versões, com anteriores no banco.

## Categorias disponíveis

Instituição: banco público, agência pública, fundação,
banco privado, cooperativa ou outro.

Modalidades: crédito, transferência, subvenção, doação, garantia
e cooperação técnica.

Áreas: saúde, educação, saneamento, mobilidade, habitação,
agricultura, cultura, esporte, assistência social, tecnologia,
meio ambiente, infraestrutura e multissetorial.

As classificações são feitas pelo usuário, sem aprovação
externa automática. Ampliações do vocabulário exigem
migração/testes controlados.

## Segurança e testes

- API `POST /api/financiers` e
  `POST /api/financiers/versions`, sessão, CSRF, Zod
  `.strict()`, papel administrativo e contexto municipal.
- URLs HTTPS públicas e dados de consulta humana validados no
  servidor; entradas externas não são interpoladas em SQL.
- Integração testa duas prefeituras, isolamento RLS, filtros,
  paginação estável, referência não verificada, versão 1-3,
  conflito entre administradores, integridade de checksums e
  proibição de UPDATE/DELETE na role web.
- Bateria complementar de 10.000 casos determinísticos
  permanece no CI.
- `ENABLE_FINANCIER_DIRECTORY=no` por padrão; homologação
  operacional issue #13 antes de habilitar em produção.

## Evolução

AF-035/036 poderão adicionar **fontes oficiais específicas**
e etapas de conferência, depois de validação de acesso a
essas fontes e suas condições de uso. O diretório AF-034
não presume catálogos ou programas verificados.
