-- AF-036: publicly identified official COFIEX/PFE documentation, NOT active financing offers.
-- Eight official references and twelve orientation/checklist stages are immutable to the web role.
CREATE TABLE public.cofiex_official_references(
 code text PRIMARY KEY CHECK(code ~ '^[a-z0-9_]{5,50}$'),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 10 AND 200),
 category text NOT NULL CHECK(category IN('institucional','portal','normativo','calendario','orientacao')),
 source_url text NOT NULL UNIQUE CHECK(
  source_url ~ '^https://' AND length(source_url) BETWEEN 18 AND 500),
 description text NOT NULL CHECK(length(btrim(description)) BETWEEN 20 AND 400),
 identified_on date NOT NULL CHECK(identified_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31')
);
INSERT INTO public.cofiex_official_references(
 code,title,category,source_url,description,identified_on) VALUES
('visao_cofiex','COFIEX — apresentação institucional','institucional','https://www.gov.br/planejamento/pt-br/assuntos/assuntos-internacionais-e-desenvolvimento/cofiex','Função e competências da comissão na preparação de projetos financiados por fontes externas',DATE '2026-11-07'),
('portal_pfe','Portal de Financiamento Externo — PFE','portal','https://pfe.sistema.gov.br/','Sistema oficial de registro, análise e acompanhamento de pleitos e envio pelo representante autorizado',DATE '2026-11-07'),
('normas_cofiex','COFIEX — legislação e atos consolidados','normativo','https://www.gov.br/planejamento/pt-br/assuntos/assuntos-internacionais-e-desenvolvimento/cofiex/legislacao/resolucoes','Repositório de resoluções e alterações normativas que precisam ser conferidas a cada consulta',DATE '2026-11-07'),
('reunioes_cofiex','Reuniões COFIEX e GTEC','calendario','https://www.gov.br/planejamento/pt-br/assuntos/assuntos-internacionais-e-desenvolvimento/cofiex/reunioes','Explicações das reuniões técnicas, Pré-COFIEX, deliberação e negociações posteriores',DATE '2026-11-07'),
('calendario_cofiex','Calendário e pauta das reuniões da COFIEX','calendario','https://www.gov.br/planejamento/pt-br/assuntos/assuntos-internacionais-e-desenvolvimento/cofiex/reunioes/reunioes-da-comissao-de-financiamentos-externos-cofiex','Calendário com prazos e pautas sujeitos a atualização e confirmação pela SEAID',DATE '2026-11-07'),
('perguntas_frequentes','Perguntas frequentes sobre financiamentos externos','orientacao','https://www.gov.br/planejamento/pt-br/assuntos/assuntos-internacionais-e-desenvolvimento/perguntas-frequentes','Perguntas e respostas institucionais sobre o PFE, critérios e financiamento externo',DATE '2026-11-07'),
('capacitacao','Capacitações e treinamentos de financiamento externo','orientacao','https://www.gov.br/planejamento/pt-br/assuntos/assuntos-internacionais-e-desenvolvimento/capacitacoes-e-treinamentos','Orientações e materiais de capacitação sobre etapas de captação internacional',DATE '2026-11-07'),
('guia_pratico_2026','Guia Prático para projetos com financiamento externo (2026)','orientacao','https://www.gov.br/planejamento/pt-br/assuntos/noticias/2026/marco/guia-pratico-para-projetos-com-financiamento-externo-traz-transparencia-acessibilidade-e-busca-ampliar-a-qualificacao-de-projetos-submetidos-a-cofiex','Apresentação institucional do guia de estruturação de projetos com financiamento externo',DATE '2026-11-07');

CREATE TABLE public.cofiex_consultation_stages(
 code text PRIMARY KEY CHECK(code ~ '^[a-z_]{5,50}$'),
 stage_number smallint NOT NULL UNIQUE CHECK(stage_number BETWEEN 1 AND 50),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 10 AND 200),
 reference_code text NOT NULL REFERENCES public.cofiex_official_references(code) ON DELETE RESTRICT,
 description text NOT NULL CHECK(length(btrim(description)) BETWEEN 20 AND 400),
 UNIQUE(code,reference_code)
);
INSERT INTO public.cofiex_consultation_stages(stage_number,code,title,reference_code,description) VALUES
(1,'identificar_escopo','Verificar escopo e objetivo do financiamento externo','visao_cofiex','Conferir finalidade da COFIEX, tipo de financiamento e enquadramento geral'),
(2,'revisar_normas','Conferir normas e alterações vigentes','normas_cofiex','Consultar resoluções atualizadas; não aplicar automaticamente prazos de versões anteriores'),
(3,'consultar_orientacoes','Consultar guia e materiais de apoio','guia_pratico_2026','Organizar diagnóstico do projeto, justificativa e documentação preparatória'),
(4,'verificar_criterios','Verificar requisitos e orientações oficiais','perguntas_frequentes','Analisar critérios, condições e documentos junto às fontes competentes'),
(5,'acessar_pfe','Preparar acesso e identificação no PFE','portal_pfe','Conferir acesso gov.br e identificação do representante habilitado no portal oficial'),
(6,'preencher_pleito','Organizar preenchimento e validação no PFE','portal_pfe','Preparar dados do pleito; validação formal ocorre exclusivamente no PFE'),
(7,'envio_formal','Confirmar envio formal pelo responsável autorizado','portal_pfe','O AXE não transmite pleitos; registrar somente a conferência interna da informação'),
(8,'reuniao_tecnica','Acompanhar reunião técnica com o GTEC','reunioes_cofiex','Consultar orientação oficial de reunião técnica após o envio do pleito'),
(9,'pre_cofiex','Acompanhar Pré-COFIEX e calendário','calendario_cofiex','Pautas e prazos devem ser confirmados na agenda oficial atualizada'),
(10,'deliberacao','Acompanhar deliberação e resultado COFIEX','calendario_cofiex','Consultar deliberação formal publicada, sem equiparar nota interna a aprovação'),
(11,'negociacao_contrato','Acompanhar negociação após autorização','reunioes_cofiex','Etapa eventual posterior, condicionada à aprovação e às instâncias competentes'),
(12,'execucao_acompanhamento','Consultar acompanhamento institucional','capacitacao','Etapa posterior de execução e monitoramento, conforme órgão competente');

-- Each municipal note is one versioned human declaration bound to a project and one official stage.
-- No automatic PFE submission, financing eligibility, or COFIEX approval is inferred.
CREATE TABLE public.project_cofiex_consultation_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 stage_code text NOT NULL REFERENCES public.cofiex_consultation_stages(code) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision BETWEEN 1 AND 1000),
 consultation_state text NOT NULL CHECK(consultation_state IN
  ('em_preparacao','conferido_internamente','aguardando_orgao','revisao_necessaria')),
 consulted_on date NOT NULL CHECK(consulted_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 reference_code text NOT NULL REFERENCES public.cofiex_official_references(code) ON DELETE RESTRICT,
 source_url_snapshot text NOT NULL CHECK(
  source_url_snapshot ~ '^https://' AND length(source_url_snapshot) BETWEEN 18 AND 500),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 20 AND 1000),
 acknowledged_limits boolean NOT NULL CHECK(acknowledged_limits),
 snapshot_sha256 char(64) NOT NULL CHECK(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 recorded_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(municipality_id,project_id,stage_code,revision),
 FOREIGN KEY(stage_code,reference_code)
  REFERENCES public.cofiex_consultation_stages(code,reference_code) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,municipality_id)
  REFERENCES public.projects(id,municipality_id) ON DELETE RESTRICT,
 FOREIGN KEY(recorded_by,municipality_id)
  REFERENCES public.users(id,municipality_id) ON DELETE RESTRICT
);
CREATE INDEX idx_project_cofiex_lookup ON public.project_cofiex_consultation_events(
 municipality_id,project_id,stage_code,revision DESC);
ALTER TABLE public.project_cofiex_consultation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_cofiex_consultation_events FORCE ROW LEVEL SECURITY;
CREATE POLICY project_cofiex_consultation_tenant ON public.project_cofiex_consultation_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND recorded_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
