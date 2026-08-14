'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { scorePlace, type Place } from '@location/shared';
import maplibregl, {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker,
  type StyleSpecification,
} from 'maplibre-gl';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const LONG_BEACH_BOUNDS = {
  south: 33.6905847,
  west: -118.248966,
  north: 33.8855595,
  east: -118.0632873,
};
const LONG_BEACH_MEAN_CENTER: [number, number] = [
  (LONG_BEACH_BOUNDS.west + LONG_BEACH_BOUNDS.east) / 2,
  (LONG_BEACH_BOUNDS.south + LONG_BEACH_BOUNDS.north) / 2,
];
const PRELOADED_CATEGORIES = [
  'restaurant',
  'fast food',
  'cafe',
  'park',
  'school',
  'convenience',
  'clinic',
  'hairdresser',
  'car repair',
  'clothes',
  'bank',
  'fuel',
  'supermarket',
  'fitness centre',
  'motel',
  'bar',
  'dentist',
  'hotel',
  'pharmacy',
  'post office',
] as const;
const VOYAGER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 512,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [{ id: 'carto-voyager', type: 'raster', source: 'carto' }],
};

type GeocoderResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type DistanceUnit = 'metric' | 'imperial';

type RoadRoute = {
  distanceM: number;
  durationS: number;
  geometry: { type: 'LineString'; coordinates: number[][] };
};

function formatDistance(distanceM: number | undefined, unit: DistanceUnit) {
  if (distanceM === undefined) return '—';
  if (unit === 'imperial') {
    const feet = distanceM * 3.28084;
    return feet < 5280
      ? `${Math.round(feet)} ft`
      : `${(feet / 5280).toFixed(1)} mi`;
  }
  return distanceM < 1000
    ? `${Math.round(distanceM)} m`
    : `${(distanceM / 1000).toFixed(1)} km`;
}

function formatDuration(durationS: number) {
  const minutes = Math.max(1, Math.round(durationS / 60));
  return `${minutes} min estimated drive`;
}

function rankingExplanation(place: Place) {
  const components = place.scoreComponents;
  if (!components) return 'Ranking components are unavailable.';
  return [
    `Score ${place.score?.toFixed(3) ?? '—'} =`,
    `55% text relevance (${components.text.toFixed(2)}) +`,
    `25% road proximity (${components.proximity.toFixed(2)}) +`,
    `15% popularity (${components.popularity.toFixed(2)}) +`,
    `5% category match (${components.category.toFixed(2)}).`,
  ].join(' ');
}

function coordinatesFromInput(value: string): [number, number] | undefined {
  const match = value.match(
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
  );
  if (!match) return undefined;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (
    lat < LONG_BEACH_BOUNDS.south ||
    lat > LONG_BEACH_BOUNDS.north ||
    lon < LONG_BEACH_BOUNDS.west ||
    lon > LONG_BEACH_BOUNDS.east
  )
    return undefined;
  return [lon, lat];
}

export default function Home() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [query, setQuery] = useState('coffee');
  const [category, setCategory] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationLabel, setLocationLabel] = useState('Long Beach mean center');
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'loading' | 'error'
  >('idle');
  const [distanceStatus, setDistanceStatus] = useState<
    'idle' | 'loading' | 'error'
  >('idle');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('imperial');
  const [roadRoute, setRoadRoute] = useState<RoadRoute>();
  const [roadRouteStatus, setRoadRouteStatus] = useState<
    'idle' | 'loading' | 'error'
  >('idle');
  const markers = useRef<Marker[]>([]);
  const centerMarker = useRef<Marker | null>(null);
  const searchCenter = useRef<[number, number]>(LONG_BEACH_MEAN_CENTER);
  const routeRequest = useRef(0);
  const categories = useMemo(
    () => [
      ...new Set([
        ...PRELOADED_CATEGORIES,
        ...(places.map((place) => place.category).filter(Boolean) as string[]),
      ]),
    ],
    [places],
  );

  function drawRoadRoute(route?: RoadRoute) {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource('selected-road-route') as
      GeoJSONSource | undefined;
    source?.setData({
      type: 'Feature',
      properties: {},
      geometry: route?.geometry ?? { type: 'LineString', coordinates: [] },
    });
  }

  function frameRoadRoute(route: RoadRoute) {
    const map = mapRef.current;
    const first = route.geometry.coordinates[0];
    if (!map || !first) return;
    const bounds = new maplibregl.LngLatBounds(
      first as [number, number],
      first as [number, number],
    );
    for (const coordinate of route.geometry.coordinates.slice(1))
      bounds.extend(coordinate as [number, number]);
    map.fitBounds(bounds, {
      padding: { top: 135, right: 42, bottom: 42, left: 42 },
      maxZoom: 15,
      duration: 700,
    });
  }

  async function loadRoadRoute(place: Place) {
    const request = ++routeRequest.current;
    setRoadRoute(undefined);
    setRoadRouteStatus('loading');
    drawRoadRoute(undefined);
    try {
      const response = await fetch(`${API}/api/v1/routes/path`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          origin: {
            latitude: searchCenter.current[1],
            longitude: searchCenter.current[0],
          },
          destination: {
            latitude: place.latitude,
            longitude: place.longitude,
          },
        }),
      });
      if (!response.ok) throw new Error();
      const route = ((await response.json()) as { data: RoadRoute }).data;
      if (request !== routeRequest.current) return;
      setRoadRoute(route);
      setRoadRouteStatus('idle');
      drawRoadRoute(route);
      frameRoadRoute(route);
    } catch {
      if (request !== routeRequest.current) return;
      setRoadRouteStatus('error');
      drawRoadRoute(undefined);
    }
  }

  function clearRoadRoute() {
    routeRequest.current += 1;
    setRoadRoute(undefined);
    setRoadRouteStatus('idle');
    drawRoadRoute(undefined);
  }

  function selectPlace(place: Place) {
    setSelected(place);
    mapRef.current?.flyTo({
      center: [place.longitude, place.latitude],
      zoom: 15,
    });
    void loadRoadRoute(place);
  }

  async function search(
    lat = searchCenter.current[1],
    lon = searchCenter.current[0],
  ) {
    setStatus('loading');
    clearRoadRoute();
    const params = new URLSearchParams({
      q: query,
      lat: String(lat),
      lon: String(lon),
      radius_m: '15000',
      limit: '40',
    });
    if (category) params.set('category', category);
    try {
      const response = await fetch(`${API}/api/v1/places/search?${params}`);
      if (!response.ok) throw new Error();
      const body = await response.json();
      const candidates = body.data as Place[];
      if (!candidates.length) {
        setPlaces([]);
        setSelected(undefined);
        setDistanceStatus('idle');
        setStatus('idle');
        return;
      }
      setDistanceStatus('loading');
      const routeResponse = await fetch(`${API}/api/v1/routes/distances`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          origin: { latitude: lat, longitude: lon },
          destinations: candidates.map((place) => ({
            id: place.id,
            latitude: place.latitude,
            longitude: place.longitude,
          })),
        }),
      });
      if (!routeResponse.ok) throw new Error();
      const routeBody = (await routeResponse.json()) as {
        data: Array<{ id: string; distanceM: number | null }>;
      };
      const roadDistances = new Map(
        routeBody.data.map((result) => [result.id, result.distanceM]),
      );
      const ranked = candidates
        .map((place) => {
          const distance = roadDistances.get(place.id);
          const distanceM = distance === null ? undefined : distance;
          if (!place.scoreComponents) return { ...place, distanceM };
          const ranking = scorePlace({
            textSimilarity: place.scoreComponents.text,
            distanceM,
            popularityScore: place.popularityScore,
            categoryMatch: place.scoreComponents.category === 1,
            radiusM: 15_000,
          });
          return {
            ...place,
            distanceM,
            score: ranking.score,
            scoreComponents: ranking.components,
          };
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setPlaces(ranked);
      setSelected(ranked[0]);
      setDistanceStatus('idle');
      setStatus('idle');
    } catch {
      setPlaces([]);
      setSelected(undefined);
      setDistanceStatus('error');
      setStatus('error');
    }
  }

  function returnHome() {
    searchCenter.current = LONG_BEACH_MEAN_CENTER;
    setLocationQuery('');
    setLocationLabel('Long Beach mean center');
    clearRoadRoute();
    const map = mapRef.current;
    if (map) {
      map.fitBounds(
        [
          [LONG_BEACH_BOUNDS.west, LONG_BEACH_BOUNDS.south],
          [LONG_BEACH_BOUNDS.east, LONG_BEACH_BOUNDS.north],
        ],
        { padding: 36, duration: 800 },
      );
      centerMarker.current?.setLngLat(LONG_BEACH_MEAN_CENTER);
    }
    void search(LONG_BEACH_MEAN_CENTER[1], LONG_BEACH_MEAN_CENTER[0]);
  }

  function moveToLocation(
    coordinates: [number, number],
    label: string,
    zoom = 14,
  ) {
    searchCenter.current = coordinates;
    setLocationLabel(label);
    clearRoadRoute();
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: coordinates, zoom });
    centerMarker.current?.remove();
    centerMarker.current = new maplibregl.Marker({ color: '#57c7ff' })
      .setLngLat(coordinates)
      .setPopup(
        new maplibregl.Popup({ offset: 22 }).setText(`Search center: ${label}`),
      )
      .addTo(map);
    void search(coordinates[1], coordinates[0]);
  }

  async function centerAroundLocation() {
    const value = locationQuery.trim();
    if (!value) {
      moveToLocation(LONG_BEACH_MEAN_CENTER, 'Long Beach mean center', 12);
      return;
    }
    const coordinates = coordinatesFromInput(value);
    if (coordinates) {
      moveToLocation(coordinates, value);
      setLocationStatus('idle');
      return;
    }
    setLocationStatus('loading');
    const params = new URLSearchParams({
      q: `${value}, Long Beach, California`,
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'us',
      bounded: '1',
      viewbox: `${LONG_BEACH_BOUNDS.west},${LONG_BEACH_BOUNDS.north},${LONG_BEACH_BOUNDS.east},${LONG_BEACH_BOUNDS.south}`,
    });
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { headers: { 'Accept-Language': 'en-US,en' } },
      );
      if (!response.ok) throw new Error();
      const [result] = (await response.json()) as GeocoderResult[];
      if (!result) throw new Error();
      const found: [number, number] = [Number(result.lon), Number(result.lat)];
      if (
        found[1] < LONG_BEACH_BOUNDS.south ||
        found[1] > LONG_BEACH_BOUNDS.north ||
        found[0] < LONG_BEACH_BOUNDS.west ||
        found[0] > LONG_BEACH_BOUNDS.east
      )
        throw new Error();
      moveToLocation(found, result.display_name);
      setLocationStatus('idle');
    } catch {
      setLocationStatus('error');
    }
  }

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: mapNode.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE ?? VOYAGER_STYLE,
      center: LONG_BEACH_MEAN_CENTER,
      zoom: 12,
    });
    mapRef.current.on('load', () => {
      mapRef.current?.addSource('selected-road-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        },
      });
      mapRef.current?.addLayer({
        id: 'selected-road-route-casing',
        type: 'line',
        source: 'selected-road-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#103c46',
          'line-width': 8,
          'line-opacity': 0.82,
        },
      });
      mapRef.current?.addLayer({
        id: 'selected-road-route-line',
        type: 'line',
        source: 'selected-road-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#57c7ff',
          'line-width': 4,
          'line-opacity': 1,
        },
      });
    });
    mapRef.current.addControl(
      new maplibregl.NavigationControl(),
      'bottom-right',
    );
    centerMarker.current = new maplibregl.Marker({ color: '#57c7ff' })
      .setLngLat(LONG_BEACH_MEAN_CENTER)
      .setPopup(
        new maplibregl.Popup({ offset: 22 }).setText(
          'Search center: Long Beach mean center',
        ),
      )
      .addTo(mapRef.current);
    void search();
    return () => {
      centerMarker.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    markers.current.forEach((m) => m.remove());
    markers.current = places.map((place) => {
      const marker = new maplibregl.Marker({
        color: selected?.id === place.id ? '#f7b32b' : '#103c46',
      })
        .setLngLat([place.longitude, place.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 22 }).setText(
            `${place.name} · ${formatDistance(place.distanceM, distanceUnit)} by road`,
          ),
        )
        .addTo(mapRef.current!);
      marker.getElement().addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectPlace(place);
      });
      marker.getElement().addEventListener('click', () => selectPlace(place));
      marker.getElement().title = `Click to select ${place.name} and show the road pathway`;
      return marker;
    });
  }, [places, selected, distanceUnit]);

  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">ATLAS / DISCOVERY</span>
          <h1>Find what is nearby in LB.</h1>
        </div>
        <p>Text relevance, proximity, and popularity—ranked transparently.</p>
      </header>
      <section className="toolbar">
        <label className="location-field">
          <span>Center around</span>
          <input
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void centerAroundLocation()}
            placeholder="Address or neighborhood in Long Beach"
            aria-describedby="location-status"
          />
          <small id="location-status">
            {locationStatus === 'loading'
              ? 'Finding location…'
              : locationStatus === 'error'
                ? 'Location not found inside Long Beach'
                : `Centered on ${locationLabel}`}
          </small>
        </label>
        <label>
          <span>Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder="coffee, museum, park…"
          />
        </label>
        <label>
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All places</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Distance units</span>
          <select
            value={distanceUnit}
            onChange={(event) =>
              setDistanceUnit(event.target.value as DistanceUnit)
            }
          >
            <option value="imperial">Imperial</option>
            <option value="metric">Metric</option>
          </select>
        </label>
        <button
          className="secondary"
          onClick={() => void centerAroundLocation()}
        >
          Center map
        </button>
        <button onClick={() => void search()}>Search</button>
        <button
          className="secondary"
          onClick={() => {
            const c = mapRef.current?.getCenter();
            if (c) {
              searchCenter.current = [c.lng, c.lat];
              setLocationLabel('current map center');
              void search(c.lat, c.lng);
            }
          }}
        >
          Search this area
        </button>
      </section>
      <section className="workspace">
        <aside>
          <div className="summary">
            <b>{places.length}</b> results{' '}
            <span>
              {status === 'loading'
                ? 'Searching…'
                : status === 'error'
                  ? 'Search or road router unavailable'
                  : distanceStatus === 'loading'
                    ? 'Calculating road distances…'
                    : 'Ranked by road distance'}
            </span>
          </div>
          <div className="results">
            {places.map((place, index) => (
              <button
                key={place.id}
                className={`result ${selected?.id === place.id ? 'active' : ''}`}
                onClick={() => selectPlace(place)}
              >
                <span
                  className="rank rank-explanation"
                  data-tooltip={rankingExplanation(place)}
                  title={rankingExplanation(place)}
                  aria-label={`Rank ${index + 1}. ${rankingExplanation(place)}`}
                  tabIndex={0}
                >
                  {String(index + 1).padStart(2, '0')}
                  <small>{place.score?.toFixed(3) ?? '—'}</small>
                </span>
                <span>
                  <b>{place.name}</b>
                  <small>
                    {[place.category, place.locality]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <em>{formatDistance(place.distanceM, distanceUnit)}</em>
              </button>
            ))}
          </div>
        </aside>
        <div className="map" ref={mapNode}>
          <span className="map-label">LIVE MAP</span>
          <button
            className="map-home"
            onClick={returnHome}
            title="Return to Long Beach extent"
          >
            ⌂ Home
          </button>
          {selected && roadRouteStatus !== 'idle' && !roadRoute && (
            <section className="road-route-widget" aria-live="polite">
              <span className="eyebrow">ROAD PATHWAY</span>
              <b>{selected.name}</b>
              <p>
                {roadRouteStatus === 'loading'
                  ? 'Calculating the drivable route from the blue origin…'
                  : 'The road pathway is temporarily unavailable.'}
              </p>
            </section>
          )}
          {selected && roadRoute && (
            <section className="road-route-widget" aria-live="polite">
              <span className="eyebrow">ROAD PATHWAY</span>
              <b>
                <i className="origin-dot" /> {locationLabel} → {selected.name}
              </b>
              <p>
                {formatDistance(roadRoute.distanceM, distanceUnit)} ·{' '}
                {formatDuration(roadRoute.durationS)}
              </p>
            </section>
          )}
          <a
            className="data-attribution"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            Place and geocoding data © OpenStreetMap contributors · ODbL
          </a>
        </div>
        {selected && (
          <article className="detail">
            <button
              aria-label="Close"
              onClick={() => {
                setSelected(undefined);
                clearRoadRoute();
              }}
            >
              ×
            </button>
            <span className="eyebrow">PLACE DETAIL</span>
            <h2>{selected.name}</h2>
            <p>
              {[selected.addressLine1, selected.locality, selected.region]
                .filter(Boolean)
                .join(', ')}
            </p>
            <dl>
              <div>
                <dt>Category</dt>
                <dd>{selected.category ?? 'Uncategorized'}</dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>
                  {formatDistance(selected.distanceM, distanceUnit)} by road
                </dd>
              </div>
              <div>
                <dt>Rank score</dt>
                <dd
                  className="score-explanation"
                  data-tooltip={rankingExplanation(selected)}
                  title={rankingExplanation(selected)}
                  tabIndex={0}
                >
                  {selected.score?.toFixed(3) ?? '—'} <span>ⓘ</span>
                </dd>
              </div>
            </dl>
          </article>
        )}
      </section>
    </main>
  );
}
