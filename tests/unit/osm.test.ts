import { describe, expect, it } from 'vitest';
import {
  LONG_BEACH_OVERPASS_QUERY,
  normalizeOsmElement,
  placesToCsv,
} from '../../apps/api/src/osm.js';

describe('Long Beach OpenStreetMap adapter', () => {
  it('anchors the query to the exact Long Beach administrative relation', () => {
    expect(LONG_BEACH_OVERPASS_QUERY).toContain('wikidata"="Q16739');
    expect(LONG_BEACH_OVERPASS_QUERY).toContain('map_to_area');
  });

  it('normalizes node tags without inventing popularity', () => {
    const place = normalizeOsmElement({
      type: 'node',
      id: 42,
      lat: 33.77,
      lon: -118.19,
      tags: {
        name: 'Actual Café',
        amenity: 'cafe',
        'addr:housenumber': '100',
        'addr:street': 'Pine Ave',
      },
    });
    expect(place).toMatchObject({
      source_id: 'node/42',
      category: 'cafe',
      subcategory: 'amenity',
      address_line1: '100 Pine Ave',
      locality: 'Long Beach',
      popularity_score: 0.5,
    });
  });

  it('uses centers for ways and emits parseable escaped JSON CSV', () => {
    const place = normalizeOsmElement({
      type: 'way',
      id: 7,
      center: { lat: 33.8, lon: -118.2 },
      tags: { name: 'Trader "Joe"', shop: 'supermarket' },
    });
    const csv = placesToCsv([place!]);
    expect(csv).toContain('way/7');
    expect(csv).toContain('Trader ""Joe""');
    expect(csv).toContain('"{""osm_type"":""way""');
  });
});
