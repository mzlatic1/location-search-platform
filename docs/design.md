# System design and evolution standard

This document is the design baseline for Atlas. `architecture.md` is the compact system
view and `decisions.md` records durable tradeoffs. Future functionality must update this
baseline or add an ADR before implementation when it changes a load-bearing decision.

## Context and containers

The browser hosts the Next.js/MapLibre interaction layer. A stateless Fastify API owns
validation, orchestration, cache policy, routing-provider calls, metrics, and OpenAPI.
The database package owns parameterized PostgreSQL/PostGIS access. Shared code owns the
public schemas, normalization, cursor, and ranking contracts. PostgreSQL is truth; Redis
is a disposable read-through cache. Overpass produces a normalized import artifact and
OSRM provides road-network distance/geometry.

## Load-bearing design rules

1. **Candidate then rank.** Indexed text/spatial predicates create a bounded candidate
   set. Expensive exact/road work is performed only for candidates.
2. **Explicit spatial semantics.** Persist WGS84 coordinates with longitude/X and
   latitude/Y. Geography calculations use meters. Any new layer must declare CRS, axis
   order, valid geometry policy, and transformation behavior.
3. **Transparent deterministic ranking.** Text relevance contributes 55%, road proximity
   25%, popularity 15%, and category 5%. Results order by score, distance, UUID. A weight
   or component change is a versioned requirement/design change with golden tests.
4. **Stable continuation.** Opaque cursors encode the ordered boundary, not a database
   offset. Contract changes require a version/migration or explicit invalidation policy.
5. **Truth and projections.** Redis may cache only reproducible responses with normalized,
   versioned keys and bounded TTL. Cache loss or stale cache must not mutate truth.
6. **External routing boundary.** OSRM clients have timeouts, bounded batch sizes, schema
   validation, and observable failure. A future self-hosted provider must implement the
   same interface before selection.
7. **Thin UI.** The UI owns presentation and interaction state, not ranking or distance
   truth. It must visually distinguish origin, selection, and route and provide textual
   equivalents for color/hover information.

## Request and failure flow

1. Validate query/body with shared schemas and reject invalid or unbounded work.
2. Normalize query/category/coordinates and construct a versioned cache key where safe.
3. Query PostGIS with indexed bounding predicates and deterministic ordering.
4. Request bounded road distances for candidates, compute final scores, and return a
   stable cursor. A selected path is fetched separately to keep ordinary searches bounded.
5. Emit structured timing/error metrics without query secrets or raw upstream payloads.

Redis failure falls through to PostgreSQL. PostgreSQL failure returns unhealthy/failure
rather than fabricated truth. OSRM failure must produce an explicit unavailable/error
state; it must not label straight-line distance as road distance. Overpass failure must
not corrupt or partially replace the last valid import.

## Data and API evolution

- Schema migrations are forward-only, reviewed, and paired with rollback/restore notes.
- Import identity remains `(source, source_id)` and each run records provenance/counts.
- Public response removal/semantic change requires a versioning and consumer migration
  plan. Additive fields remain optional until every consumer is compatible.
- Ranking/cursor changes require deterministic fixtures spanning equal score, equal
  distance, and pagination boundaries.
- New spatial datasets require license/provenance, CRS/bounds/schema/validity/null checks,
  row counts, and a small visual sample before use.

## Security, privacy, accessibility, and observability

- Accept no arbitrary upstream URL from a client. Configure providers server-side.
- Validate coordinates, identifiers, text length, bbox area, pagination, and rate limits.
- Parameterize database access and keep credentials in untracked environment files.
- Location input is request data, not an identity profile; do not add persistent user
  histories or analytics without a new privacy requirement and retention design.
- Controls require labels, keyboard focus, sufficient contrast, and text descriptions.
- Preserve `/health`, `/metrics`, request correlation, dependency timing, cache outcome,
  and import batch evidence. Define new SLO/alerts only from measured behavior.

## Design checklist for future functionality

Before code, document:

```text
Problem and linked requirement IDs
In scope / out of scope
Current behavior and evidence
Proposed components and data flow
API/schema/CRS/unit changes
Failure, timeout, retry, idempotency, and rollback behavior
Security/privacy/accessibility impact
Metrics/logging/operational impact
Test matrix and acceptance evidence
Alternatives and decision/ADR
```

Prefer an ADR when the decision changes system boundaries, truth ownership, persistence,
consistency, ranking semantics, an external provider, or a major dependency. Amend this
baseline when the new decision becomes part of the ordinary implementation workflow.
