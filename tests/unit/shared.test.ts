import { describe, expect, it } from 'vitest';
import {
  decodeCursor,
  encodeCursor,
  makeCacheKey,
  normalizeText,
  scorePlace,
  searchQuerySchema,
} from '../../packages/shared/src/index.js';
describe('shared search behavior', () => {
  it('round trips opaque cursors', () => {
    const c = { score: 0.4, distance: 12, id: 'a' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it('rejects malformed cursors', () =>
    expect(() => decodeCursor('not-json')).toThrow('Invalid cursor'));
  it('requires paired coordinates', () =>
    expect(searchQuerySchema.safeParse({ lat: 2 }).success).toBe(false));
  it('normalizes Unicode and stable cache ordering', () => {
    expect(normalizeText(' Café! ')).toBe('cafe');
    expect(makeCacheKey('x', { b: ' Café ', a: 1 })).toBe(
      'places:v1:x:a=1&b=cafe',
    );
  });
  it('normalizes all score components', () => {
    const result = scorePlace({
      textSimilarity: 2,
      distanceM: 500,
      popularityScore: -2,
      categoryMatch: true,
      radiusM: 1000,
    });
    expect(result.score).toBeCloseTo(0.725);
    expect(result.components).toEqual({
      text: 1,
      proximity: 0.5,
      popularity: 0,
      category: 1,
    });
  });
});
