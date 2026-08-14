ALTER TABLE places
  ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (
    lower(
      regexp_replace(
        name || ' ' || coalesce(category, '') || ' ' || coalesce(subcategory, ''),
        '[^[:alnum:]]+',
        ' ',
        'g'
      )
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS places_search_text_trgm
  ON places USING gin (search_text gin_trgm_ops);
