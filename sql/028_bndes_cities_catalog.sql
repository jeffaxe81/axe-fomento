-- AF-035: 37 referenced solution pages linked by the official BNDES Cidades portal.
-- reference_observed_on records the cataloging date, NOT lender availability.
-- Seed entries are national public references; municipal review events are tenant-private.
CREATE TABLE public.bndes_city_solutions (
 code text PRIMARY KEY CHECK (code ~ '^[a-z0-9-]{8,120}$'),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 5 AND 220),
 area text NOT NULL CHECK(area IN ('urbano','clima','cultura','energia','mobilidade','infraestrutura','saneamento','educacao','saude','seguranca','assistencia','gestao')),
 summary text NOT NULL CHECK(length(btrim(summary)) BETWEEN 15 AND 300),
 source_url text NOT NULL UNIQUE CHECK(
  source_url LIKE 'https://cidades.bndes.gov.br/solucao/%'
  AND length(source_url) BETWEEN 50 AND 300),
 reference_observed_on date NOT NULL CHECK(
  reference_observed_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 source_scope text NOT NULL DEFAULT 'official_page_identified'
  CHECK(source_scope='official_page_identified')
);
CREATE INDEX idx_bndes_cities_area ON public.bndes_city_solutions(area,title,code);
INSERT INTO public.bndes_city_solutions(code,title,area,summary,source_url,reference_observed_on)
VALUES
('urbanizacao-integrada','Urbanização integrada','urbano','Infraestrutura urbana, espaços públicos e projetos integrados','https://cidades.bndes.gov.br/solucao/urbanizacao-integrada/',DATE '2026-11-07'),
('prevencao-e-gestao-de-riscos-de-desastres-e-adaptacao-climatica','Prevenção de desastres e adaptação climática','clima','Prevenção de desastres e modernização da infraestrutura de resposta','https://cidades.bndes.gov.br/solucao/prevencao-e-gestao-de-riscos-de-desastres-e-adaptacao-climatica/',DATE '2026-11-07'),
('patrimonio-cultural-e-natural-e-turismo','Patrimônio cultural, natural e turismo','cultura','Preservação e requalificação de patrimônio e equipamentos turísticos','https://cidades.bndes.gov.br/solucao/patrimonio-cultural-e-natural-e-turismo/',DATE '2026-11-07'),
('iluminacao-publica','Iluminação pública','energia','Modernização da iluminação pública municipal','https://cidades.bndes.gov.br/solucao/iluminacao-publica/',DATE '2026-11-07'),
('eficiencia-energetica-de-predios-publicos','Eficiência energética de prédios públicos','energia','Redução do consumo de energia em imóveis municipais','https://cidades.bndes.gov.br/solucao/eficiencia-energetica-de-predios-publicos/',DATE '2026-11-07'),
('eletrificacao-da-frota','Eletrificação da frota','mobilidade','Veículos elétricos e modernização de frotas municipais','https://cidades.bndes.gov.br/solucao/eletrificacao-da-frota/',DATE '2026-11-07'),
('mobilidade-urbana','Mobilidade urbana','mobilidade','Melhorias em sistemas e serviços de transporte urbano','https://cidades.bndes.gov.br/solucao/mobilidade-urbana/',DATE '2026-11-07'),
('infraestrutura-logistica','Infraestrutura logística','infraestrutura','Recuperação e modernização de infraestrutura logística','https://cidades.bndes.gov.br/solucao/infraestrutura-logistica/',DATE '2026-11-07'),
('agua-e-esgoto','Água e esgoto','saneamento','Ampliação de infraestrutura de abastecimento e coleta de esgoto','https://cidades.bndes.gov.br/solucao/agua-e-esgoto/',DATE '2026-11-07'),
('residuos-solidos','Resíduos sólidos','saneamento','Projetos municipais de gestão de resíduos','https://cidades.bndes.gov.br/solucao/residuos-solidos/',DATE '2026-11-07'),
('melhoria-e-expansao-de-servicos-de-educacao','Melhoria e expansão de serviços de educação','educacao','Ampliação e modernização dos serviços educacionais','https://cidades.bndes.gov.br/solucao/melhoria-e-expansao-de-servicos-de-educacao/',DATE '2026-11-07'),
('provedores-de-internet-para-unidades-escolares','Conectividade para unidades escolares','educacao','Conectividade e infraestrutura de internet para escolas','https://cidades.bndes.gov.br/solucao/provedores-de-internet-para-unidades-escolares/',DATE '2026-11-07'),
('melhoria-e-expansao-de-servicos-de-saude','Melhoria e expansão de serviços de saúde','saude','Expansão e modernização da rede municipal de saúde','https://cidades.bndes.gov.br/solucao/melhoria-e-expansao-de-servicos-de-saude/',DATE '2026-11-07'),
('seguranca-publica-e-defesa-social','Segurança pública e defesa social','seguranca','Equipamentos, infraestrutura e inteligência para segurança pública','https://cidades.bndes.gov.br/solucao/seguranca-publica-e-defesa-social/',DATE '2026-11-07'),
('melhoria-e-expansao-de-servicos-de-assistencia-social-e-economia-do-cuidado','Assistência social e economia do cuidado','assistencia','Fortalecimento de serviços de assistência social e cuidado','https://cidades.bndes.gov.br/solucao/melhoria-e-expansao-de-servicos-de-assistencia-social-e-economia-do-cuidado/',DATE '2026-11-07'),
('inclusao-produtiva','Inclusão produtiva','assistencia','Iniciativas municipais de inclusão produtiva e acesso ao trabalho','https://cidades.bndes.gov.br/solucao/inclusao-produtiva/',DATE '2026-11-07'),
('modernizacao-da-gestao-tributaria-fiscal-e-orcamentaria-e-da-arrecadacao-municipal','Modernização da gestão tributária e arrecadação','gestao','Sistemas e processos para gestão fiscal e arrecadação','https://cidades.bndes.gov.br/solucao/modernizacao-da-gestao-tributaria-fiscal-e-orcamentaria-e-da-arrecadacao-municipal/',DATE '2026-11-07'),
('modernizacao-da-gestao-dos-servicos-essenciais','Modernização da gestão dos serviços essenciais','gestao','Modernização tecnológica e administrativa de serviços públicos','https://cidades.bndes.gov.br/solucao/modernizacao-da-gestao-dos-servicos-essenciais/',DATE '2026-11-07'),
('centro-integrado-de-comando-e-controle','Centro integrado de comando e controle','gestao','Integração de informação, monitoramento e operações da cidade','https://cidades.bndes.gov.br/solucao/centro-integrado-de-comando-e-controle/',DATE '2026-11-07'),
('bndes-maquinas-e-servicos-iluminacao-publica','Máquinas e Serviços: iluminação pública','energia','Aquisição de luminárias e serviços de modernização','https://cidades.bndes.gov.br/solucao/bndes-maquinas-e-servicos-iluminacao-publica/',DATE '2026-11-07'),
('bndes-maquinas-e-servicos-veiculos-escolares','Máquinas e Serviços: veículos escolares','educacao','Veículos escolares de programa de transporte educacional','https://cidades.bndes.gov.br/solucao/bndes-maquinas-e-servicos-veiculos-escolares/',DATE '2026-11-07'),
('bndes-maquinas-e-servicos-rede-de-frios-para-imunizantes','Máquinas e Serviços: rede de frios para imunizantes','saude','Equipamentos para conservação de imunizantes','https://cidades.bndes.gov.br/solucao/bndes-maquinas-e-servicos-rede-de-frios-para-imunizantes/',DATE '2026-11-07'),
('prevencao-gestao-riscos-desastres-adaptacao-climatica','Gestão de riscos e adaptação climática: alternativa','clima','Projetos de prevenção e resposta a eventos climáticos','https://cidades.bndes.gov.br/solucao/prevencao-gestao-riscos-desastres-adaptacao-climatica/',DATE '2026-11-07'),
('mobilidade-urbana-ate-100','Mobilidade urbana: alternativa para municípios','mobilidade','Áreas verdes, ciclovias e infraestrutura urbana resiliente','https://cidades.bndes.gov.br/solucao/mobilidade-urbana-ate-100/',DATE '2026-11-07'),
('tratamento-destinacao-residuos','Tratamento e destinação de resíduos','saneamento','Soluções de tratamento, destinação e coleta de resíduos','https://cidades.bndes.gov.br/solucao/tratamento-destinacao-residuos/',DATE '2026-11-07'),
('requalificacao-urbana','Requalificação urbana','urbano','Revitalização urbana e melhoria de espaços em áreas vulneráveis','https://cidades.bndes.gov.br/solucao/requalificacao-urbana/',DATE '2026-11-07'),
('eficiencia-energetica-em-predios-publicos-e-iluminacao-publica-eficiente','Eficiência de prédios e iluminação pública','energia','Modernização energética em edifícios e iluminação municipais','https://cidades.bndes.gov.br/solucao/eficiencia-energetica-em-predios-publicos-e-iluminacao-publica-eficiente/',DATE '2026-11-07'),
('iluminacao-publica-ate-100','Iluminação pública: alternativa para municípios','energia','Aquisição de iluminação LED para vias e equipamentos públicos','https://cidades.bndes.gov.br/solucao/iluminacao-publica-ate-100/',DATE '2026-11-07'),
('eletrificacao-da-frota-ate-100','Eletrificação da frota: alternativa para municípios','mobilidade','Eletrificação e modernização de veículos municipais','https://cidades.bndes.gov.br/solucao/eletrificacao-da-frota-ate-100/',DATE '2026-11-07'),
('transporte-escolar-ate-100','Transporte escolar: alternativa para municípios','educacao','Veículos para o transporte de estudantes da rede pública','https://cidades.bndes.gov.br/solucao/transporte-escolar-ate-100/',DATE '2026-11-07'),
('reforma-construcao-escola','Reforma e construção de escola','educacao','Infraestrutura e instalações de unidades escolares','https://cidades.bndes.gov.br/solucao/reforma-construcao-escola/',DATE '2026-11-07'),
('equipamentos-isolados-saude','Equipamentos destinados à saúde','saude','Aquisição de equipamentos para unidades de saúde','https://cidades.bndes.gov.br/solucao/equipamentos-isolados-saude/',DATE '2026-11-07'),
('reforma-construcao-ubs','Reforma e construção de UBS','saude','Infraestrutura e equipamentos de unidades básicas de saúde','https://cidades.bndes.gov.br/solucao/reforma-construcao-ubs/',DATE '2026-11-07'),
('maquinas-obras-viarias-pavimentacao','Máquinas para obras viárias e pavimentação','infraestrutura','Aquisição de máquinas utilizadas em obras públicas viárias','https://cidades.bndes.gov.br/solucao/maquinas-obras-viarias-pavimentacao/',DATE '2026-11-07'),
('pavimentacao-recuperacao-vias','Pavimentação e recuperação de vias','infraestrutura','Recuperação de pavimentos e infraestrutura viária','https://cidades.bndes.gov.br/solucao/pavimentacao-recuperacao-vias/',DATE '2026-11-07'),
('modernizacao-gestao-tributaria-fiscal-orcamentaria-arrecadacao','Modernização tributária e orçamentária: alternativa','gestao','Tecnologia para modernização da administração financeira','https://cidades.bndes.gov.br/solucao/modernizacao-gestao-tributaria-fiscal-orcamentaria-arrecadacao/',DATE '2026-11-07'),
('aquisicao-equipamentos-de-informatica','Equipamentos de informática para gestão pública','gestao','Equipamentos para administração, operação e fiscalização','https://cidades.bndes.gov.br/solucao/aquisicao-equipamentos-de-informatica/',DATE '2026-11-07');

CREATE TABLE public.municipal_bndes_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 solution_code text NOT NULL REFERENCES public.bndes_city_solutions(code) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 source_state text NOT NULL CHECK(source_state IN
  ('pagina_conferida','atualizacao_pendente','pagina_indisponivel')),
 availability_state text NOT NULL CHECK(availability_state IN
  ('nao_apurada','possibilidade_mencionada','nao_localizada')),
 checked_on date NOT NULL CHECK(checked_on BETWEEN DATE '2000-01-01' AND CURRENT_DATE),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 20 AND 1000),
 source_url_snapshot text NOT NULL CHECK(
  source_url_snapshot LIKE 'https://cidades.bndes.gov.br/solucao/%'),
 acknowledged_limits boolean NOT NULL CHECK(acknowledged_limits=true),
 snapshot_sha256 char(64) NOT NULL CHECK(snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 reviewer_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(municipality_id,solution_code,revision),
 FOREIGN KEY(municipality_id) REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 FOREIGN KEY(reviewer_id,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_bndes_reviews_last
 ON public.municipal_bndes_review_events(municipality_id,solution_code,revision DESC);

ALTER TABLE public.municipal_bndes_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_bndes_review_events FORCE ROW LEVEL SECURITY;
CREATE POLICY bndes_reviews_tenant ON public.municipal_bndes_review_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(
  municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND reviewer_id=NULLIF(current_setting('app.actor_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM public.users u
   WHERE u.id=reviewer_id AND u.municipality_id=municipality_id
    AND u.active=true AND u.role='admin')
 );
