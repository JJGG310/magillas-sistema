-- Magillas Accesorios — persistencia Supabase
-- Aplicada en proyecto Supabase (tablas con RLS, solo service_role desde el servidor)

CREATE TABLE IF NOT EXISTS magillas_orders (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS magillas_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  producto text NOT NULL,
  nombre text NOT NULL,
  estrellas int NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario text,
  fecha timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS magillas_newsletter (
  email text PRIMARY KEY,
  fecha timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS magillas_reviews_producto_idx ON magillas_reviews (producto);
CREATE INDEX IF NOT EXISTS magillas_orders_created_idx ON magillas_orders (created_at DESC);

ALTER TABLE magillas_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE magillas_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE magillas_newsletter ENABLE ROW LEVEL SECURITY;
