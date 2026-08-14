import { describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app.js';
import { MemoryCache } from '../../apps/api/src/cache.js';
import type {
  PlaceRepository,
  SearchInput,
} from '../../packages/db/src/index.js';
import type { Place } from '../../packages/shared/src/index.js';
const sample: Place = {
  id: '9c6d35e6-4f6c-49cc-8a65-bfa86559bd57',
  name: 'Café Azul',
  category: 'cafe',
  subcategory: null,
  addressLine1: null,
  locality: 'Long Beach',
  region: 'CA',
  countryCode: 'US',
  latitude: 33.7,
  longitude: -118.1,
  popularityScore: 0.8,
  score: 0.7,
  distanceM: 12,
};
class Repo implements PlaceRepository {
  last?: SearchInput;
  async search(i: SearchInput) {
    this.last = i;
    return [sample];
  }
  async bbox() {
    return [sample];
  }
  async byId(id: string) {
    return id === sample.id ? sample : undefined;
  }
  async autocomplete() {
    return [
      {
        id: sample.id,
        name: sample.name,
        category: sample.category,
        locality: sample.locality,
      },
    ];
  }
  async ping() {
    return true;
  }
  async close() {}
}
describe('API', () => {
  it('reports dependency health', async () => {
    const app = buildApp({ repository: new Repo(), cache: new MemoryCache() });
    const r = await app.inject({ method: 'GET', url: '/health' });
    expect(r.statusCode).toBe(200);
    await app.close();
  });
  it('returns consistent validation errors', async () => {
    const app = buildApp({ repository: new Repo(), cache: new MemoryCache() });
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/places/search?lat=12',
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('INVALID_QUERY');
    await app.close();
  });
  it('paginates and returns results', async () => {
    const app = buildApp({ repository: new Repo(), cache: new MemoryCache() });
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/places/search?q=cafe&lat=33.7&lon=-118.1',
    });
    expect(r.json().data[0].name).toBe('Café Azul');
    await app.close();
  });
  it('returns 404 for unknown place', async () => {
    const app = buildApp({ repository: new Repo(), cache: new MemoryCache() });
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/places/11111111-1111-4111-8111-111111111111',
    });
    expect(r.statusCode).toBe(404);
    await app.close();
  });
});
