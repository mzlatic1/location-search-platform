import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  LONG_BEACH_OVERPASS_QUERY,
  normalizeOsmElement,
  placesToCsv,
  type OsmElement,
} from './osm.js';

const outputIndex = process.argv.indexOf('--output');
const output = resolve(
  outputIndex >= 0 && process.argv[outputIndex + 1]
    ? process.argv[outputIndex + 1]!
    : '../../data/long-beach-osm.csv',
);
const endpoints = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

async function download() {
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent':
            'location-search-platform/0.1 (Long Beach portfolio data import)',
        },
        body: new URLSearchParams({ data: LONG_BEACH_OVERPASS_QUERY }),
        signal: AbortSignal.timeout(240_000),
      });
      if (!response.ok)
        throw new Error(`Overpass returned HTTP ${response.status}`);
      return (await response.json()) as { elements: OsmElement[] };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const started = performance.now();
const payload = await download();
const places = payload.elements
  .map(normalizeOsmElement)
  .filter((place) => place !== undefined);
if (!places.length) throw new Error('Overpass returned no usable places');

await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
await writeFile(temporary, `${placesToCsv(places)}\n`, 'utf8');
await rename(temporary, output);
console.log(
  JSON.stringify({
    output,
    elementsRead: payload.elements.length,
    placesWritten: places.length,
    durationMs: Math.round(performance.now() - started),
    boundary: 'Long Beach, California (OSM relation wikidata=Q16739)',
    attribution: '© OpenStreetMap contributors; ODbL',
  }),
);
