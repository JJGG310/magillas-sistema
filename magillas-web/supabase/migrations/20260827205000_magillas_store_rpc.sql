-- Magillas: persistencia vía RPC (anon key + secreto servidor) cuando no hay service_role
-- Secreto en app_secrets.name = 'magillas_store' (mismo valor que ADMIN_TOKEN del servidor)

CREATE OR REPLACE FUNCTION magillas_auth_ok(p_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_secrets
    WHERE name = 'magillas_store' AND value = p_secret
  );
$$;

-- (ver funciones magillas_* en Supabase — aplicada vía MCP 2026-08-27)

DROP POLICY IF EXISTS magillas_reviews_public_read ON magillas_reviews;
CREATE POLICY magillas_reviews_public_read ON magillas_reviews
  FOR SELECT USING (true);

GRANT SELECT ON magillas_reviews TO anon, authenticated;
