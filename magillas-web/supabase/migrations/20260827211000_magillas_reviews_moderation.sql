-- Moderación de reseñas: nuevas entran pendientes, admin aprueba desde panel
ALTER TABLE magillas_reviews ADD COLUMN IF NOT EXISTS aprobada boolean NOT NULL DEFAULT false;
UPDATE magillas_reviews SET aprobada = true;

CREATE OR REPLACE FUNCTION magillas_guardar_resena(
  p_secret text, p_producto text, p_nombre text,
  p_estrellas int, p_comentario text, p_fecha timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT magillas_auth_ok(p_secret) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  INSERT INTO magillas_reviews (producto, nombre, estrellas, comentario, fecha, aprobada)
  VALUES (p_producto, p_nombre, p_estrellas, p_comentario, p_fecha, false);
END;
$$;

CREATE OR REPLACE FUNCTION magillas_aprobar_resena(
  p_secret text, p_fecha timestamptz, p_producto text, p_aprobada boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT magillas_auth_ok(p_secret) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  UPDATE magillas_reviews SET aprobada = p_aprobada
  WHERE fecha = p_fecha AND producto = p_producto;
END;
$$;

GRANT EXECUTE ON FUNCTION magillas_aprobar_resena(text, timestamptz, text, boolean) TO anon, authenticated, service_role;
