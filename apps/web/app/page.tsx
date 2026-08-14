'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Place } from '@location/shared';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const center: [number, number] = [-118.1937, 33.7701];

export default function Home() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [query, setQuery] = useState('coffee');
  const [category, setCategory] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const markers = useRef<Marker[]>([]);
  const categories = useMemo(
    () =>
      [...new Set(places.map((p) => p.category).filter(Boolean))] as string[],
    [places],
  );

  async function search(lat = center[1], lon = center[0]) {
    setStatus('loading');
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
      setPlaces(body.data);
      setSelected(body.data[0]);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: mapNode.current,
      style:
        process.env.NEXT_PUBLIC_MAP_STYLE ??
        'https://demotiles.maplibre.org/style.json',
      center,
      zoom: 12,
    });
    mapRef.current.addControl(
      new maplibregl.NavigationControl(),
      'bottom-right',
    );
    void search();
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    markers.current.forEach((m) => m.remove());
    markers.current = places.map((place) =>
      new maplibregl.Marker({
        color: selected?.id === place.id ? '#f7b32b' : '#103c46',
      })
        .setLngLat([place.longitude, place.latitude])
        .setPopup(new maplibregl.Popup({ offset: 22 }).setText(place.name))
        .addTo(mapRef.current!),
    );
  }, [places, selected]);

  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">ATLAS / DISCOVERY</span>
          <h1>Find what is nearby.</h1>
        </div>
        <p>Text relevance, proximity, and popularity—ranked transparently.</p>
      </header>
      <section className="toolbar">
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
        <button onClick={() => void search()}>Search</button>
        <button
          className="secondary"
          onClick={() => {
            const c = mapRef.current?.getCenter();
            if (c) void search(c.lat, c.lng);
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
                  ? 'API unavailable'
                  : 'Ranked for you'}
            </span>
          </div>
          <div className="results">
            {places.map((place, index) => (
              <button
                key={place.id}
                className={`result ${selected?.id === place.id ? 'active' : ''}`}
                onClick={() => {
                  setSelected(place);
                  mapRef.current?.flyTo({
                    center: [place.longitude, place.latitude],
                    zoom: 15,
                  });
                }}
              >
                <span className="rank">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <b>{place.name}</b>
                  <small>
                    {[place.category, place.locality]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <em>
                  {place.distanceM === undefined
                    ? ''
                    : place.distanceM < 1000
                      ? `${Math.round(place.distanceM)} m`
                      : `${(place.distanceM / 1000).toFixed(1)} km`}
                </em>
              </button>
            ))}
          </div>
        </aside>
        <div className="map" ref={mapNode}>
          <span className="map-label">LIVE MAP</span>
          <a
            className="data-attribution"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            Place data © OpenStreetMap contributors · ODbL
          </a>
        </div>
        {selected && (
          <article className="detail">
            <button aria-label="Close" onClick={() => setSelected(undefined)}>
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
                  {selected.distanceM
                    ? `${Math.round(selected.distanceM)} m`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Rank score</dt>
                <dd>{selected.score?.toFixed(3) ?? '—'}</dd>
              </div>
            </dl>
          </article>
        )}
      </section>
    </main>
  );
}
