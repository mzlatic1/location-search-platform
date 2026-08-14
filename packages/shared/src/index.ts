import { z } from 'zod';

export const coordinatesSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    radius_m: z.coerce.number().int().positive().max(50_000).default(5_000),
    category: z.string().trim().max(60).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20),
    cursor: z.string().max(512).optional(),
    sort: z.enum(['relevance', 'distance']).default('relevance'),
    explain: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  })
  .superRefine((value, ctx) => {
    if ((value.lat === undefined) !== (value.lon === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lat and lon must be supplied together',
      });
    }
  });

export const bboxQuerySchema = z.object({
  west: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  category: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().positive().max(1000).default(250),
});

export type Place = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  addressLine1: string | null;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  popularityScore: number;
  source?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  distanceM?: number;
  score?: number;
  scoreComponents?: {
    text: number;
    proximity: number;
    popularity: number;
    category: number;
  };
};

export type SearchCursor = {
  score: number;
  distance: number | null;
  id: string;
};

export function encodeCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(value?: string): SearchCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as SearchCursor;
    if (
      !parsed.id ||
      !Number.isFinite(parsed.score) ||
      (parsed.distance !== null && !Number.isFinite(parsed.distance))
    ) {
      throw new Error('invalid values');
    }
    return parsed;
  } catch {
    throw new Error('Invalid cursor');
  }
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function makeCacheKey(
  namespace: string,
  params: Record<string, unknown>,
): string {
  const stable = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) =>
        `${key}=${typeof value === 'string' ? normalizeText(value) : String(value)}`,
    )
    .join('&');
  return `places:v1:${namespace}:${stable}`;
}

export function scorePlace(input: {
  textSimilarity: number;
  distanceM?: number;
  popularityScore: number;
  categoryMatch: boolean;
  radiusM: number;
}) {
  const text = Math.max(0, Math.min(1, input.textSimilarity));
  const proximity =
    input.distanceM === undefined
      ? 0
      : Math.max(0, 1 - input.distanceM / input.radiusM);
  const popularity = Math.max(0, Math.min(1, input.popularityScore));
  const category = input.categoryMatch ? 1 : 0;
  return {
    score: text * 0.55 + proximity * 0.25 + popularity * 0.15 + category * 0.05,
    components: { text, proximity, popularity, category },
  };
}
