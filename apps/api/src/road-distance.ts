export type Coordinate = { latitude: number; longitude: number };

export interface RoadDistanceService {
  distances(
    origin: Coordinate,
    destinations: Coordinate[],
  ): Promise<Array<number | null>>;
}

type OsrmTableResponse = {
  code?: string;
  distances?: Array<Array<number | null>>;
};

export class OsrmRoadDistanceService implements RoadDistanceService {
  constructor(
    private readonly baseUrl = process.env.OSRM_URL ??
      'https://router.project-osrm.org',
  ) {}

  async distances(origin: Coordinate, destinations: Coordinate[]) {
    if (!destinations.length) return [];
    const coordinates = [origin, ...destinations]
      .map(({ longitude, latitude }) => `${longitude},${latitude}`)
      .join(';');
    const destinationIndexes = destinations
      .map((_, index) => index + 1)
      .join(';');
    const url = new URL(`/table/v1/driving/${coordinates}`, this.baseUrl);
    url.searchParams.set('sources', '0');
    url.searchParams.set('destinations', destinationIndexes);
    url.searchParams.set('annotations', 'distance');

    const response = await fetch(url, {
      headers: { 'user-agent': 'location-search-platform/0.1' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok)
      throw new Error(`Road router returned HTTP ${response.status}`);
    const payload = (await response.json()) as OsrmTableResponse;
    const distances = payload.distances?.[0];
    if (payload.code !== 'Ok' || distances?.length !== destinations.length)
      throw new Error('Road router returned an invalid distance table');
    return distances;
  }
}
