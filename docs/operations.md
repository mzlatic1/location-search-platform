# Operations

- `/health` treats PostgreSQL as required and Redis as degradable.
- `/metrics` exposes HTTP totals, process metrics, search latency, and cache outcomes.
- Logs are structured JSON and include Fastify request IDs.
- Stop with SIGTERM; Fastify drains bounded in-flight requests and closes both clients.
- Back up PostgreSQL using normal logical/physical procedures; Redis needs no backup.
- Rotate database/Redis credentials through environment secrets, never committed files.

Incident order: inspect health, DB saturation/slow queries, Redis state, error labels,
then request logs. If Redis is down, reduce traffic or restore it before DB amplification
causes a secondary incident. Schema changes use additive migrations and a tested rollback.
