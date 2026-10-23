-- 004: MFA TOTP (secret encrypted by application key), session rotation and session administration.
-- All privileged functions are owned by migration role. Never expose MFA cipher columns to fomento_app.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mfa_secret_cipher text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mfa_pending_cipher text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mfa_last_step bigint;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS mfa_verified boolean NOT NULL DEFAULT true;

-- Changed return shape: remove existing function before replacement.
DROP FUNCTION IF EXISTS public.auth_login(text,text);
CREATE FUNCTION public.auth_login(p_email text,p_password text)
RETURNS TABLE(id uuid,sid uuid,mfa_required boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE found_id uuid; found_hash text; tenant uuid; uses_mfa boolean;
BEGIN
  SELECT u.id,u.password_hash,u.municipality_id,u.mfa_enabled
    INTO found_id,found_hash,tenant,uses_mfa
    FROM public.users u WHERE lower(u.email)=lower(p_email) AND u.active=true LIMIT 1;
  IF found_hash IS NULL THEN
    PERFORM public.crypt(p_password,'$2a$12$C6UzMDM.H6dfI/f/IKcEeO8F2gEqMqCrxU63lSu3JH8p2JQfLQKGS');
    RETURN;
  END IF;
  IF found_hash = public.crypt(p_password,found_hash) THEN
    INSERT INTO public.user_sessions(user_id,municipality_id,expires_at,mfa_verified)
    VALUES(found_id,tenant,clock_timestamp()+
      CASE WHEN uses_mfa THEN interval '5 minutes' ELSE interval '8 hours' END, NOT uses_mfa)
    RETURNING user_sessions.id INTO sid;
    id:=found_id;mfa_required:=uses_mfa;RETURN NEXT;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.auth_login(text,text) FROM PUBLIC;

-- A session pending MFA must not be treated as authenticated.
CREATE OR REPLACE FUNCTION public.auth_session_user(p_user_id uuid,p_sid uuid)
RETURNS TABLE(id uuid,full_name text,email text,role text,municipality_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT u.id,u.full_name,u.email,u.role,u.municipality_id
  FROM public.users u JOIN public.user_sessions s
    ON s.user_id=u.id AND s.municipality_id=u.municipality_id
  WHERE u.id=p_user_id AND s.id=p_sid AND u.active=true
    AND s.mfa_verified=true AND s.revoked_at IS NULL AND s.expires_at>now()
$$;
REVOKE ALL ON FUNCTION public.auth_session_user(uuid,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.auth_mfa_begin(p_user uuid,p_sid uuid,p_cipher text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF length(p_cipher)>400 OR length(p_cipher)<40 THEN RETURN false; END IF;
  UPDATE public.users u SET mfa_pending_cipher=p_cipher
  WHERE u.id=p_user AND u.active AND NOT u.mfa_enabled AND EXISTS (
    SELECT 1 FROM public.user_sessions s WHERE s.id=p_sid AND s.user_id=u.id
      AND s.mfa_verified AND s.revoked_at IS NULL AND s.expires_at>now());
  RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION public.auth_mfa_pending_secret(p_user uuid,p_sid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT u.mfa_pending_cipher FROM public.users u JOIN public.user_sessions s ON s.user_id=u.id
  WHERE u.id=p_user AND s.id=p_sid AND s.mfa_verified AND s.revoked_at IS NULL
    AND s.expires_at>now() AND u.active AND NOT u.mfa_enabled
$$;
CREATE OR REPLACE FUNCTION public.auth_mfa_enable(p_user uuid,p_sid uuid,p_step bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.users u SET mfa_secret_cipher=u.mfa_pending_cipher,
    mfa_pending_cipher=NULL,mfa_enabled=true,mfa_last_step=p_step
  WHERE u.id=p_user AND u.active AND NOT u.mfa_enabled AND u.mfa_pending_cipher IS NOT NULL
    AND EXISTS(SELECT 1 FROM public.user_sessions s WHERE s.user_id=u.id AND s.id=p_sid
      AND s.mfa_verified AND s.revoked_at IS NULL AND s.expires_at>now());
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.user_sessions SET revoked_at=coalesce(revoked_at,clock_timestamp())
    WHERE user_id=p_user AND id<>p_sid AND revoked_at IS NULL;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.auth_mfa_login_secret(p_user uuid,p_sid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT u.mfa_secret_cipher FROM public.users u JOIN public.user_sessions s ON s.user_id=u.id
  WHERE u.id=p_user AND s.id=p_sid AND NOT s.mfa_verified AND s.revoked_at IS NULL
    AND s.expires_at>now() AND u.active AND u.mfa_enabled
$$;

CREATE OR REPLACE FUNCTION public.auth_mfa_complete(p_user uuid,p_sid uuid,p_step bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  -- Serialize replay prevention across concurrent MFA submissions.
  UPDATE public.users u SET mfa_last_step=p_step WHERE u.id=p_user AND u.active AND u.mfa_enabled
    AND (u.mfa_last_step IS NULL OR u.mfa_last_step<p_step)
    AND EXISTS (SELECT 1 FROM public.user_sessions s WHERE s.id=p_sid AND s.user_id=u.id
      AND NOT s.mfa_verified AND s.revoked_at IS NULL AND s.expires_at>now());
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.user_sessions SET mfa_verified=true,expires_at=clock_timestamp()+interval '8 hours'
    WHERE id=p_sid AND user_id=p_user AND NOT mfa_verified AND revoked_at IS NULL AND expires_at>now();
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.auth_list_sessions(p_user uuid,p_sid uuid)
RETURNS TABLE(id uuid,created_at timestamptz,expires_at timestamptz,is_current boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT s.id,s.created_at,s.expires_at,s.id=p_sid
  FROM public.user_sessions s
  WHERE s.user_id=p_user AND s.revoked_at IS NULL AND s.expires_at>now() AND s.mfa_verified
    AND EXISTS (SELECT 1 FROM public.user_sessions t JOIN public.users u ON u.id=t.user_id
      WHERE t.id=p_sid AND t.user_id=p_user AND t.mfa_verified
      AND t.revoked_at IS NULL AND t.expires_at>now() AND u.active)
  ORDER BY s.created_at DESC LIMIT 50
$$;
CREATE OR REPLACE FUNCTION public.auth_revoke_other_sessions(p_user uuid,p_sid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE count_revoked integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.user_sessions s JOIN public.users u ON u.id=s.user_id
    WHERE s.id=p_sid AND s.user_id=p_user AND s.mfa_verified AND s.revoked_at IS NULL
      AND s.expires_at>now() AND u.active) THEN RETURN 0; END IF;
  UPDATE public.user_sessions SET revoked_at=clock_timestamp()
    WHERE user_id=p_user AND id<>p_sid AND revoked_at IS NULL;
  GET DIAGNOSTICS count_revoked=ROW_COUNT;
  RETURN count_revoked;
END $$;

REVOKE ALL ON FUNCTION public.auth_mfa_begin(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_mfa_pending_secret(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_mfa_enable(uuid,uuid,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_mfa_login_secret(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_mfa_complete(uuid,uuid,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_list_sessions(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_revoke_other_sessions(uuid,uuid) FROM PUBLIC;
