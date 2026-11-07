-- AF-031. PostgreSQL Portuguese full text search indexes.
-- No external embedding service; never merge source_programs into opportunities.
CREATE INDEX idx_semantic_opportunity_title_provider ON public.opportunities
 USING gin (to_tsvector('portuguese'::regconfig,title || ' ' || provider));
CREATE INDEX idx_semantic_source_program_title_provider ON public.source_programs
 USING gin (to_tsvector('portuguese'::regconfig,title || ' ' || provider));
CREATE INDEX idx_semantic_source_program_tenant_approved
 ON public.source_programs(municipality_id,last_seen_at DESC,id DESC)
 WHERE review_state='approved';
