import pg from 'pg';
import type { Place, SearchCursor } from '@location/shared';

const { Pool } = pg;

export type SearchInput = {
  q?: string;
  lat?: number;
  lon?: number;
  radiusM: number;
  category?: string;
  limit: number;
  cursor?: SearchCursor;
  sort: 'relevance' | 'distance';
};

export interface PlaceRepository {
  search(input: SearchInput): Promise<Place[]>;
  bbox(input: {
    west: number;
    south: number;
    east: number;
    north: number;
    category?: string;
    limit: number;
  }): Promise<Place[]>;
  byId(id: string): Promise<Place | undefined>;
  autocomplete(
    q: string,
    limit: number,
  ): Promise<Array<Pick<Place, 'id' | 'name' | 'category' | 'locality'>>>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

type PlaceRow = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  address_line1: string | null;
  locality: string | null;
  region: string | null;
  country_code: string | null;
  latitude: number;
  longitude: number;
  popularity_score: number;
  source: string;
  source_id: string;
  metadata: Record<string, unknown>;
  distance_m: number | null;
  score: number | null;
  text_score: number | null;
  proximity_score: number | null;
  category_score: number | null;
};

function mapPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    addressLine1: row.address_line1,
    locality: row.locality,
    region: row.region,
    countryCode: row.country_code,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    popularityScore: Number(row.popularity_score),
    source: row.source,
    sourceId: row.source_id,
    metadata: row.metadata,
    distanceM: row.distance_m === null ? undefined : Number(row.distance_m),
    score: row.score === null ? undefined : Number(row.score),
    scoreComponents:
      row.score === null
        ? undefined
        : {
            text: Number(row.text_score),
            proximity: Number(row.proximity_score),
            popularity: Number(row.popularity_score),
            category: Number(row.category_score),
          },
  };
}

export class PostgresPlaceRepository implements PlaceRepository {
  private readonly pool;
  constructor(connectionString = process.env.DATABASE_URL) {
    this.pool = new Pool({
      connectionString,
      max: 15,
      statement_timeout: Number(
        process.env.SEARCH_STATEMENT_TIMEOUT_MS ?? 2500,
      ),
    });
  }

  async ping() {
    const result = await this.pool.query('SELECT 1 ok');
    return result.rowCount === 1;
  }
  async close() {
    await this.pool.end();
  }

  async search(input: SearchInput): Promise<Place[]> {
    const values: unknown[] = [
      input.q ?? '',
      input.lat ?? null,
      input.lon ?? null,
      input.radiusM,
      input.category ?? null,
      input.limit,
    ];
    const cursor = input.cursor;
    values.push(
      cursor?.score ?? null,
      cursor?.distance ?? null,
      cursor?.id ?? null,
    );
    const distance = `CASE WHEN $2::float8 IS NULL THEN NULL ELSE ST_Distance(geom, ST_SetSRID(ST_MakePoint($3,$2),4326)::geography) END`;
    const textScore = `CASE WHEN $1 = '' THEN 0 ELSE GREATEST(similarity(normalized_name, lower($1)), CASE WHEN normalized_name LIKE lower($1) || '%' THEN 1 ELSE 0 END) END`;
    const proximity = `CASE WHEN $2::float8 IS NULL THEN 0 ELSE GREATEST(0, 1 - (${distance} / $4)) END`;
    const categoryScore = `CASE WHEN $5::text IS NOT NULL AND category = $5 THEN 1 ELSE 0 END`;
    const score = `((${textScore}) * .55 + (${proximity}) * .25 + popularity_score * .15 + (${categoryScore}) * .05)`;
    const order =
      input.sort === 'distance' && input.lat !== undefined
        ? `distance_m ASC NULLS LAST, score DESC, id ASC`
        : `score DESC, distance_m ASC NULLS LAST, id ASC`;
    const cursorFilter = !cursor
      ? ''
      : input.sort === 'distance' && input.lat !== undefined
        ? `AND (distance_m, -score, id) > ($8::float8, -$7::float8, $9::uuid)`
        : `AND (-score, COALESCE(distance_m, 'Infinity'::float8), id) > (-$7::float8, COALESCE($8::float8, 'Infinity'::float8), $9::uuid)`;
    const sql = `
      WITH candidates AS (
        SELECT *, ${distance} AS distance_m, ${textScore} AS text_score,
          ${proximity} AS proximity_score, ${categoryScore} AS category_score, ${score} AS score
        FROM places
        WHERE ($1 = '' OR normalized_name % lower($1) OR normalized_name LIKE lower($1) || '%')
          AND ($5::text IS NULL OR category = $5)
          AND ($2::float8 IS NULL OR ST_DWithin(geom, ST_SetSRID(ST_MakePoint($3,$2),4326)::geography, $4))
      )
      SELECT * FROM candidates WHERE true ${cursorFilter}
      ORDER BY ${order} LIMIT $6`;
    const result = await this.pool.query<PlaceRow>(sql, values);
    return result.rows.map(mapPlace);
  }

  async bbox(input: {
    west: number;
    south: number;
    east: number;
    north: number;
    category?: string;
    limit: number;
  }) {
    const result = await this.pool.query<PlaceRow>(
      `
      SELECT *, NULL::float8 distance_m, NULL::float8 score, NULL::float8 text_score,
        NULL::float8 proximity_score, NULL::float8 category_score
      FROM places
      WHERE ST_Intersects(geom::geometry, ST_MakeEnvelope($1,$2,$3,$4,4326))
        AND ($5::text IS NULL OR category = $5)
      ORDER BY popularity_score DESC, id LIMIT $6`,
      [
        input.west,
        input.south,
        input.east,
        input.north,
        input.category ?? null,
        input.limit,
      ],
    );
    return result.rows.map(mapPlace);
  }

  async byId(id: string) {
    const result = await this.pool.query<PlaceRow>(
      `SELECT *, NULL::float8 distance_m, NULL::float8 score,
      NULL::float8 text_score, NULL::float8 proximity_score, NULL::float8 category_score FROM places WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? mapPlace(result.rows[0]) : undefined;
  }

  async autocomplete(q: string, limit: number) {
    const result = await this.pool.query<PlaceRow>(
      `SELECT *, NULL::float8 distance_m, NULL::float8 score,
      NULL::float8 text_score, NULL::float8 proximity_score, NULL::float8 category_score
      FROM places WHERE normalized_name LIKE lower($1) || '%' OR normalized_name % lower($1)
      ORDER BY (normalized_name LIKE lower($1) || '%') DESC, similarity(normalized_name,lower($1)) DESC,
      popularity_score DESC, id LIMIT $2`,
      [q, limit],
    );
    return result.rows
      .map(mapPlace)
      .map(({ id, name, category, locality }) => ({
        id,
        name,
        category,
        locality,
      }));
  }
}
