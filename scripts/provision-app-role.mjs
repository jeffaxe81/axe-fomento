import pg from 'pg';
// Owner-only provisioning. NEVER expose DATABASE_ADMIN_URL to the web container.
const {DATABASE_ADMIN_URL, APP_DB_PASSWORD}=process.env;
if (!DATABASE_ADMIN_URL || !APP_DB_PASSWORD || APP_DB_PASSWORD.length < 24)
  throw new Error('Defina DATABASE_ADMIN_URL e APP_DB_PASSWORD (mínimo 24 caracteres).');
const db=new pg.Client({connectionString:DATABASE_ADMIN_URL});
await db.connect();
try {
  if (!(await db.query("SELECT 1 FROM pg_roles WHERE rolname='fomento_app'")).rowCount)
    await db.query('CREATE ROLE fomento_app LOGIN');
  const {rows:[{stmt}]}=await db.query(
    "SELECT format('ALTER ROLE fomento_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS PASSWORD %L',$1::text) AS stmt",
    [APP_DB_PASSWORD]);
  await db.query(stmt);
  await db.query('BEGIN');
  await db.query('GRANT USAGE ON SCHEMA public TO fomento_app');
  await db.query('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM fomento_app');
  await db.query('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM fomento_app');
  for(const table of ['funding_observations','funding_cases','funding_case_events'])
    await db.query('GRANT SELECT,INSERT ON public.'+table+' TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE(is_active) ON public.funding_alert_subscriptions TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.source_contract_checks TO fomento_app');
  await db.query('GRANT SELECT ON public.opportunities TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.municipal_capag TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_capag_history TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_document_templates TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_document_checklists TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.project_document_items TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_document_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_document_versions TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_document_validity_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_secretariats TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.municipal_secretariat_members TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_secretariat_member_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.municipal_tasks TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_task_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.project_internal_reviews TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_internal_review_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_external_protocols TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.project_protocol_diligences TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_protocol_diligence_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.project_financial_milestones TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_financial_milestone_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_budget_stages TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_budget_items TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_budget_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_normative_sources TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_normative_versions TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_modality_checks TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_modality_review_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_edict_extraction_batches TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_edict_suggestions TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_edict_suggestion_reviews TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_proposal_drafts TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_proposal_versions TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_proposal_review_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_financiers TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_financier_versions TO fomento_app');
  await db.query('GRANT SELECT ON public.bndes_city_solutions TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_bndes_review_events TO fomento_app');
  await db.query('GRANT SELECT ON public.cofiex_official_references TO fomento_app');
  await db.query('GRANT SELECT ON public.cofiex_consultation_stages TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_cofiex_consultation_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.international_cooperation_calls TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.international_application_routes TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.municipal_consortia TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.consortium_memberships TO fomento_app');
  await db.query('GRANT UPDATE(state,revision,updated_by,updated_actor_municipality_id,updated_at) ON public.consortium_memberships TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.consortium_membership_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.consortium_project_shares TO fomento_app');
  await db.query('GRANT UPDATE(enabled,revision,updated_by,updated_at) ON public.consortium_project_shares TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.consortium_share_events TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.consortium_municipality_directory(uuid,uuid) TO fomento_app');
  for(const table of ['readiness_cases','readiness_case_evidence','readiness_rubric_versions',
    'readiness_assessments','readiness_review_events','readiness_action_assignments'])
    await db.query('GRANT SELECT,INSERT ON public.'+table+' TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.opportunity_requirements TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.project_requirement_assessments TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.project_requirement_events TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.source_programs TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.source_program_versions TO fomento_app');
  await db.query('GRANT SELECT,INSERT ON public.source_program_reviews TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE ON public.source_ingestion_runs TO fomento_app');
  await db.query('GRANT SELECT,INSERT,DELETE ON public.opportunity_favorites TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON public.saved_opportunity_searches TO fomento_app');
  await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON public.projects TO fomento_app');
  await db.query('GRANT SELECT, UPDATE (ibge_code,population,priority_areas) ON public.municipalities TO fomento_app');
  await db.query('GRANT SELECT(id,municipality_id,full_name,email,role,active) ON public.users TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_login(text,text) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_session_user(uuid,uuid) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_revoke_session(uuid,uuid) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_consume_limit(text) TO fomento_app');
  for (const signature of [
    'auth_mfa_begin(uuid,uuid,text)',
    'auth_mfa_pending_secret(uuid,uuid)',
    'auth_mfa_enable(uuid,uuid,bigint)',
    'auth_mfa_login_secret(uuid,uuid)',
    'auth_mfa_complete(uuid,uuid,bigint)',
    'auth_mfa_status(uuid,uuid)',
    'auth_list_sessions(uuid,uuid)',
    'auth_revoke_other_sessions(uuid,uuid)'
  ]) await db.query('GRANT EXECUTE ON FUNCTION public.' + signature + ' TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_change_password(uuid,uuid,text,text) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_admin_issue_invite(uuid,uuid,text,text,text) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_invite_accept(text,text,text) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_admin_set_account_state(uuid,uuid,uuid,boolean) TO fomento_app');
  await db.query('GRANT EXECUTE ON FUNCTION public.auth_admin_list_invites(uuid,uuid) TO fomento_app');
  await db.query('COMMIT');
  console.log('Role fomento_app provisionada com acesso restrito e RLS.');
} catch(e){try {await db.query('ROLLBACK')} catch {} throw e;} finally {await db.end();}
