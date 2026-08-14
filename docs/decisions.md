# Architecture decisions

## ADR-001 — Modular monolith

**Decision:** one Fastify API and one Next.js UI. **Why:** it exposes the important SQL,
relevance, and reliability concerns without distributed deployment overhead. Services
can split only when scaling/ownership evidence appears.

## ADR-002 — PostGIS geography

**Decision:** store generated `geography(Point,4326)`. **Why:** API radii are meters and
great-circle behavior matters. Raw lat/lon remain constrained and inspectable.

## ADR-003 — PostgreSQL text search first

**Decision:** `pg_trgm` plus prefixes. **Why:** one consistent store is enough for the MVP;
an external search engine adds synchronization and operational failure modes.

## ADR-004 — Read-through Redis

**Decision:** cache autocomplete/detail only with versioned normalized keys and short
TTL. **Why:** semantics are clear and cache loss cannot change truth.

## ADR-005 — Seek pagination

**Decision:** score/distance/UUID cursor rather than offset. **Why:** stable complexity and
deterministic page boundaries for an unchanged dataset.

## ADR-006 — One cross-tool engineering contract

**Decision:** `AGENTS.md` is the tool-neutral repository instruction source and
`CLAUDE.md` imports it; requirements, design, workflow, and handoff state remain separate
tracked documents. **Why:** Codex and Claude Code must start, implement, validate, and wrap
with the same invariants without duplicating rules that can drift. Tool-specific commands
may route into the shared protocol but cannot override it.
