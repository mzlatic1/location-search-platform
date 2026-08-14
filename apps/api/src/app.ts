import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from 'prom-client';
import { z, ZodError } from 'zod';
import {
  bboxQuerySchema,
  decodeCursor,
  encodeCursor,
  makeCacheKey,
  searchQuerySchema,
} from '@location/shared';
import { PostgresPlaceRepository, type PlaceRepository } from '@location/db';
import { RedisCache, type Cache } from './cache.js';
import {
  OsrmRoadDistanceService,
  type RoadDistanceService,
} from './road-distance.js';

export type AppDependencies = {
  repository?: PlaceRepository;
  cache?: Cache;
  roadDistance?: RoadDistanceService;
  version?: string;
};

export function buildApp(deps: AppDependencies = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    requestIdHeader: 'x-request-id',
    requestTimeout: 10_000,
  });
  const repository = deps.repository ?? new PostgresPlaceRepository();
  const cache = deps.cache ?? new RedisCache();
  const roadDistance = deps.roadDistance ?? new OsrmRoadDistanceService();
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: 'location_search_' });
  const requests = new Counter({
    name: 'location_search_http_requests_total',
    help: 'HTTP requests',
    labelNames: ['route', 'status'],
    registers: [registry],
  });
  const searchLatency = new Histogram({
    name: 'location_search_query_duration_seconds',
    help: 'Search query latency',
    labelNames: ['operation'],
    registers: [registry],
  });
  const cacheOps = new Counter({
    name: 'location_search_cache_operations_total',
    help: 'Cache hit/miss/error',
    labelNames: ['result'],
    registers: [registry],
  });

  void app.register(cors, {
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
  });
  void app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  void app.register(swagger, {
    openapi: {
      info: {
        title: 'Location Search API',
        version: deps.version ?? process.env.API_VERSION ?? 'dev',
      },
    },
  });
  void app.register(swaggerUi, { routePrefix: '/docs' });

  app.addHook('onResponse', (request, reply, done) => {
    requests.inc({
      route: request.routeOptions.url,
      status: String(reply.statusCode),
    });
    done();
  });

  async function cached<T>(
    key: string,
    ttl: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    try {
      const found = await cache.get<T>(key);
      if (found !== undefined) {
        cacheOps.inc({ result: 'hit' });
        return found;
      }
      cacheOps.inc({ result: 'miss' });
    } catch (error) {
      cacheOps.inc({ result: 'error' });
      app.log.warn({ err: error }, 'Redis read failed; using database');
    }
    const result = await loader();
    try {
      await cache.set(key, result, ttl);
    } catch (error) {
      cacheOps.inc({ result: 'error' });
      app.log.warn({ err: error }, 'Redis write failed');
    }
    return result;
  }

  app.get('/health', async (_request, reply) => {
    const [database, redis] = await Promise.all([
      repository.ping().catch(() => false),
      cache.ping().catch(() => false),
    ]);
    const healthy = database;
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      dependencies: { database, redis },
      version: deps.version ?? process.env.API_VERSION ?? 'dev',
    });
  });
  app.get('/metrics', async (_request, reply) =>
    reply.type(registry.contentType).send(await registry.metrics()),
  );

  app.get('/api/v1/places/search', async (request) => {
    const query = searchQuerySchema.parse(request.query);
    let cursor;
    try {
      cursor = decodeCursor(query.cursor);
    } catch {
      throw Object.assign(new Error('Cursor is malformed or incompatible'), {
        statusCode: 400,
        code: 'INVALID_CURSOR',
      });
    }
    const timer = searchLatency.startTimer({ operation: 'search' });
    try {
      const places = await repository.search({
        q: query.q,
        lat: query.lat,
        lon: query.lon,
        radiusM: query.radius_m,
        category: query.category,
        limit: query.limit + 1,
        cursor,
        sort: query.sort,
      });
      const hasMore = places.length > query.limit;
      const page = places
        .slice(0, query.limit)
        .map((place) =>
          query.explain || process.env.NODE_ENV !== 'production'
            ? place
            : { ...place, scoreComponents: undefined },
        );
      const last = page.at(-1);
      return {
        data: page,
        page: {
          nextCursor:
            hasMore && last
              ? encodeCursor({
                  score: last.score ?? 0,
                  distance: last.distanceM ?? null,
                  id: last.id,
                })
              : null,
          hasMore,
        },
      };
    } finally {
      timer();
    }
  });

  app.get('/api/v1/places/nearby', async (request) => {
    const query = z
      .object({
        lat: z.coerce.number().min(-90).max(90),
        lon: z.coerce.number().min(-180).max(180),
        radius_m: z.coerce.number().int().positive().max(50_000).default(5_000),
        category: z.string().trim().max(60).optional(),
        limit: z.coerce.number().int().positive().max(100).default(20),
        cursor: z.string().max(512).optional(),
      })
      .parse(request.query);
    let cursor;
    try {
      cursor = decodeCursor(query.cursor);
    } catch {
      throw Object.assign(new Error('Cursor is malformed or incompatible'), {
        statusCode: 400,
        code: 'INVALID_CURSOR',
      });
    }
    const places = await repository.search({
      lat: query.lat,
      lon: query.lon,
      radiusM: query.radius_m,
      category: query.category,
      limit: query.limit + 1,
      cursor,
      sort: 'distance',
    });
    const page = places.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page,
      page: {
        hasMore: places.length > query.limit,
        nextCursor:
          places.length > query.limit && last
            ? encodeCursor({
                score: last.score ?? 0,
                distance: last.distanceM ?? null,
                id: last.id,
              })
            : null,
      },
    };
  });

  app.get('/api/v1/places/bbox', async (request) => {
    const query = bboxQuerySchema
      .superRefine((v, ctx) => {
        if (v.west >= v.east || v.south >= v.north)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'bbox edges are inverted',
          });
        if ((v.east - v.west) * (v.north - v.south) > 100)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'bbox area exceeds the safe maximum',
          });
      })
      .parse(request.query);
    return { data: await repository.bbox(query) };
  });

  app.get('/api/v1/places/autocomplete', async (request) => {
    const query = z
      .object({
        q: z.string().trim().min(2).max(80),
        limit: z.coerce.number().int().min(1).max(10).default(8),
      })
      .parse(request.query);
    const key = makeCacheKey('autocomplete', query);
    return {
      data: await cached(key, 120, () =>
        repository.autocomplete(query.q, query.limit),
      ),
    };
  });

  app.post('/api/v1/routes/distances', async (request) => {
    const coordinate = z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    });
    const body = z
      .object({
        origin: coordinate,
        destinations: z
          .array(coordinate.extend({ id: z.string().min(1).max(128) }))
          .min(1)
          .max(40),
      })
      .parse(request.body);
    const distances = await roadDistance.distances(
      body.origin,
      body.destinations,
    );
    return {
      data: body.destinations.map((destination, index) => ({
        id: destination.id,
        distanceM: distances[index],
      })),
      profile: 'driving',
      calculation: 'road-network',
    };
  });

  app.get('/api/v1/places/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const key = makeCacheKey('detail', { id });
    const place = await cached(key, 300, () => repository.byId(id));
    if (!place)
      return reply
        .code(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Place not found' } });
    return { data: place };
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: {
          code: 'INVALID_QUERY',
          message: error.issues.map((i) => i.message).join('; '),
        },
      });
    const status =
      (error as any).statusCode && Number((error as any).statusCode) < 500
        ? Number((error as any).statusCode)
        : 500;
    if (status === 500) request.log.error({ err: error }, 'request failed');
    return reply.code(status).send({
      error: {
        code:
          (error as any).code ??
          (status === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
        message:
          status === 500
            ? 'Internal server error'
            : String((error as Error).message),
      },
    });
  });

  app.addHook('onClose', async () => {
    await Promise.allSettled([repository.close(), cache.close()]);
  });
  return app;
}
