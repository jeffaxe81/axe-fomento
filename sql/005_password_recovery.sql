-- 005: password rotation and operator-approved MFA recovery; audit remains append-only to web role.
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_events DROP CONSTRAINT IF EXISTS audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check
  CHECK (action IN ('project.insert','project.update','project.delete','municipality.update',
    'security.password_change','security.mfa_reset'));

-- The caller must possess a currently active FULL session and know the current password.
-- Returns a fresh database session id after atomically revoking all prior tokens.
CREATE OR REPLACE FUNCTION public.auth_change_password(
  p_user uuid,p_sid uuid,p_current_password text,p_new_password text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE existing_hash text; tenant uuid; new_sid uuid;
BEGIN
  IF length(p_new_password)<12 OR length(p_new_password)>128
    OR p_new_password !~ '[[:lower:]]' OR p_new_password !~ '[[:upper:]]'
    OR p_new_password !~ '[[:digit:]]' OR p_new_password !~ '[^[:alnum:]]'
    THEN RETURN NULL; END IF;
  SELECT u.password_hash,u.municipality_id INTO existing_hash,tenant
  FROM public.users u WHERE u.id=p_user AND u.active=true
    AND EXISTS(SELECT 1 FROM public.user_sessions s WHERE s.id=p_sid
      AND s.user_id=u.id AND s.municipality_id=u.municipality_id
      AND s.mfa_verified AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp())
  FOR UPDATE;
  IF NOT FOUND OR existing_hash <> public.crypt(p_current_password,existing_hash)
    OR existing_hash=public.crypt(p_new_password,existing_hash) THEN RETURN NULL; END IF;
  UPDATE public.users SET password_hash=public.crypt(p_new_password,public.gen_salt('bf',12))
    WHERE id=p_user;
  UPDATE public.user_sessions SET revoked_at=clock_timestamp()
    WHERE user_id=p_user AND revoked_at IS NULL;
  INSERT INTO public.user_sessions(user_id,municipality_id,expires_at,mfa_verified)
    VALUES(p_user,tenant,clock_timestamp()+interval '8 hours',true)
    RETURNING id INTO new_sid;
  INSERT INTO public.audit_events(municipality_id,actor_user_id,action,record_id)
    VALUES(tenant,p_user,'security.password_change',p_user);
  RETURN new_sid;
END $$;
REVOKE ALL ON FUNCTION public.auth_change_password(uuid,uuid,text,text) FROM PUBLIC;
