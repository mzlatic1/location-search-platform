# Architecture

The browser calls one stateless Fastify API. PostgreSQL is authoritative; Redis is a
disposable read-through cache. The database package owns explicit parameterized SQL,
while shared code owns validation, cursor, normalization, and rank rules. This keeps
one deployable backend without coupling imports or UI code to storage details.

Search is two-phase: indexed text/spatial predicates generate candidates, then the
query calculates exact distance and a transparent score. UUID is the final tie-breaker.
Importer and online traffic share only the normalized schema, so the source adapter can
change independently.

Failure boundary: Redis loss increases DB load but not correctness. PostgreSQL loss is
reported by `/health` and API requests fail rather than return invented or stale truth.
Fastify request, Redis command, and PostgreSQL statement timeouts bound work.
