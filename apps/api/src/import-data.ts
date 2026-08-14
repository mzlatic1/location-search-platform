import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parse } from 'csv-parse';
import pg from 'pg';

const fileIndex = process.argv.indexOf('--file');
const file = fileIndex >= 0 ? process.argv[fileIndex + 1] : undefined;
if (!file)
  throw new Error('Usage: pnpm import:data -- --file <normalized.csv>');
const source = process.env.IMPORT_SOURCE ?? 'csv';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const batchId = randomUUID();
const started = performance.now();
let read = 0,
  inserted = 0,
  updated = 0,
  rejected = 0;
await pool.query('INSERT INTO import_batches(id, source_file) VALUES ($1,$2)', [
  batchId,
  file,
]);
try {
  const parser = createReadStream(file).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true }),
  );
  for await (const raw of parser) {
    read += 1;
    const row = raw as Record<string, string>;
    const latitude = Number(row.latitude),
      longitude = Number(row.longitude);
    if (
      !row.source_id ||
      !row.name ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      rejected += 1;
      continue;
    }
    const result = await pool.query(
      `INSERT INTO places(source_id,source,name,category,subcategory,address_line1,locality,region,postal_code,country_code,latitude,longitude,popularity_score,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT(source,source_id) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,subcategory=EXCLUDED.subcategory,address_line1=EXCLUDED.address_line1,locality=EXCLUDED.locality,region=EXCLUDED.region,postal_code=EXCLUDED.postal_code,country_code=EXCLUDED.country_code,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,popularity_score=EXCLUDED.popularity_score,metadata=EXCLUDED.metadata,updated_at=now()
      RETURNING (xmax = 0) AS was_inserted`,
      [
        row.source_id,
        source,
        row.name,
        row.category || null,
        row.subcategory || null,
        row.address_line1 || null,
        row.locality || null,
        row.region || null,
        row.postal_code || null,
        row.country_code || null,
        latitude,
        longitude,
        Number(row.popularity_score || 0),
        JSON.parse(row.metadata || '{}'),
      ],
    );
    if (result.rows[0]?.was_inserted) inserted += 1;
    else updated += 1;
  }
  const duration = Math.round(performance.now() - started);
  await pool.query(
    `UPDATE import_batches SET completed_at=now(),rows_read=$2,inserted=$3,updated=$4,rejected=$5,duration_ms=$6,status='complete' WHERE id=$1`,
    [batchId, read, inserted, updated, rejected, duration],
  );
  console.log(
    JSON.stringify({
      batchId,
      rowsRead: read,
      inserted,
      updated,
      rejected,
      durationMs: duration,
    }),
  );
} catch (error) {
  await pool.query(
    `UPDATE import_batches SET completed_at=now(),rows_read=$2,inserted=$3,updated=$4,rejected=$5,duration_ms=$6,status='failed' WHERE id=$1`,
    [
      batchId,
      read,
      inserted,
      updated,
      rejected,
      Math.round(performance.now() - started),
    ],
  );
  throw error;
} finally {
  await pool.end();
}
