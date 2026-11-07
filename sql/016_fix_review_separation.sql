-- AF-021: restrição de segregação só compara responsáveis quando ambos foram definidos.
-- Campos ainda não atribuídos não constituem identidade duplicada.
ALTER TABLE public.project_internal_reviews
 DROP CONSTRAINT review_separation,
 ADD CONSTRAINT review_separation CHECK(
   (technically_reviewed_by IS NULL OR submitted_by<>technically_reviewed_by)
   AND (authorized_by IS NULL OR submitted_by<>authorized_by)
   AND (authorized_by IS NULL OR technically_reviewed_by<>authorized_by)
 );
