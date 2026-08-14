export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type NormalizedOsmPlace = {
  source_id: string;
  name: string;
  category: string;
  subcategory: string;
  address_line1: string;
  locality: string;
  region: string;
  postal_code: string;
  country_code: string;
  latitude: number;
  longitude: number;
  popularity_score: number;
  metadata: Record<string, unknown>;
};

const categoryKeys = [
  'amenity',
  'shop',
  'tourism',
  'leisure',
  'historic',
  'healthcare',
  'office',
  'craft',
  'public_transport',
  'railway',
] as const;

export const LONG_BEACH_OVERPASS_QUERY = `[out:json][timeout:180];
rel["boundary"="administrative"]["wikidata"="Q16739"];
map_to_area -> .searchArea;
(
  nwr(area.searchArea)["name"]["amenity"];
  nwr(area.searchArea)["name"]["shop"];
  nwr(area.searchArea)["name"]["tourism"];
  nwr(area.searchArea)["name"]["leisure"];
  nwr(area.searchArea)["name"]["historic"];
  nwr(area.searchArea)["name"]["office"];
  nwr(area.searchArea)["name"]["craft"];
  nwr(area.searchArea)["name"]["healthcare"];
  nwr(area.searchArea)["name"]["public_transport"];
  nwr(area.searchArea)["name"]["railway"~"^(station|halt|tram_stop)$"];
);
out center tags;`;

function display(value: string) {
  return value.replaceAll('_', ' ');
}

export function normalizeOsmElement(
  element: OsmElement,
): NormalizedOsmPlace | undefined {
  const tags = element.tags;
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (
    !tags?.name ||
    latitude === undefined ||
    longitude === undefined ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return undefined;

  const categoryKey = categoryKeys.find((key) => tags[key]);
  if (!categoryKey) return undefined;
  const categoryValue = tags[categoryKey]!;
  const address = [tags['addr:housenumber'], tags['addr:street']]
    .filter(Boolean)
    .join(' ');

  return {
    source_id: `${element.type}/${element.id}`,
    name: tags.name,
    category: display(categoryValue),
    subcategory: display(categoryKey),
    address_line1: address,
    locality: tags['addr:city'] || 'Long Beach',
    region: tags['addr:state'] || 'CA',
    postal_code: tags['addr:postcode'] || '',
    country_code: tags['addr:country'] || 'US',
    latitude,
    longitude,
    // OSM does not provide popularity. A neutral value avoids inventing a signal.
    popularity_score: 0.5,
    metadata: {
      osm_type: element.type,
      osm_id: element.id,
      osm_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      tags,
      attribution: '© OpenStreetMap contributors; ODbL',
    },
  };
}

export function csvEscape(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function placesToCsv(places: NormalizedOsmPlace[]) {
  const columns: Array<keyof NormalizedOsmPlace> = [
    'source_id',
    'name',
    'category',
    'subcategory',
    'address_line1',
    'locality',
    'region',
    'postal_code',
    'country_code',
    'latitude',
    'longitude',
    'popularity_score',
    'metadata',
  ];
  return [
    columns.join(','),
    ...places.map((place) =>
      columns.map((column) => csvEscape(place[column])).join(','),
    ),
  ].join('\n');
}
