CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY,
  source_file text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  rows_read bigint NOT NULL DEFAULT 0,
  inserted bigint NOT NULL DEFAULT 0,
  updated bigint NOT NULL DEFAULT 0,
  rejected bigint NOT NULL DEFAULT 0,
  duration_ms bigint,
  status text NOT NULL DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  source text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name text GENERATED ALWAYS AS (lower(regexp_replace(name, '[^[:alnum:]]+', ' ', 'g'))) STORED,
  category text,
  subcategory text,
  address_line1 text,
  locality text,
  region text,
  postal_code text,
  country_code char(2),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  geom geography(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
  popularity_score double precision NOT NULL DEFAULT 0 CHECK (popularity_score BETWEEN 0 AND 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS places_geom_gist ON places USING gist (geom);
CREATE INDEX IF NOT EXISTS places_name_trgm ON places USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS places_category_idx ON places (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS places_category_popularity_idx ON places (category, popularity_score DESC, id);
