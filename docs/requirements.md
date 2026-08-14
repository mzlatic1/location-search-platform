# Product and engineering requirements

This is the requirements baseline for Atlas. `README.md` explains how to use the current
application; this document defines what the application must do and the quality gates a
future change must preserve. A behavior change is incomplete until its requirement,
acceptance evidence, design impact, tests, and user/operator documentation agree.

## Product boundary

Atlas helps a user discover and rank named places within Long Beach, California around a
chosen Long Beach origin. It demonstrates bounded geospatial retrieval, transparent
ranking, road-network distance, stable pagination, cache fallback, and an interactive
map/list interface. General geocoding, turn-by-turn navigation, user accounts, reviews,
payments, and multi-city coverage are outside the current scope.

## Functional requirements

| ID    | Requirement                                                                                                                                              | Acceptance evidence                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| FR-01 | Import normalized named-place records idempotently by `(source, source_id)` and reject invalid coordinates.                                              | Importer tests and recorded batch counts.              |
| FR-02 | Limit the reproducible OSM acquisition and interactive geocoder to the Long Beach administrative boundary.                                               | Boundary/fetch tests and UI smoke check.               |
| FR-03 | Support bounded text, nearby, bounding-box, autocomplete, detail, route-distance, and selected-route-path API operations.                                | OpenAPI plus unit/integration contract tests.          |
| FR-04 | Rank search results with the documented text, road proximity, popularity, and category weights and deterministic tie-breaking.                           | Ranking tests and `explain=true` output.               |
| FR-05 | Use actual road-network distance for every displayed result and final proximity score; clearly surface routing failure rather than invent a road result. | Mocked OSRM tests and live smoke check when requested. |
| FR-06 | Let users choose a Long Beach address/neighborhood/ZIP/coordinate origin, default to the city mean center, and distinguish origin from selection.        | UI interaction test or reviewed smoke evidence.        |
| FR-07 | Keep map and result selection equivalent: panel selection, marker click, and double-click select/zoom consistently.                                      | UI regression coverage and smoke check.                |
| FR-08 | Draw the selected road path and show origin, destination, distance, and duration; Home restores the default city extent.                                 | Route-path API tests and UI smoke check.               |
| FR-09 | Offer preloaded place categories and imperial/metric display without changing stored metric truth.                                                       | Component/API tests.                                   |
| FR-10 | Preserve required OSM/CARTO attribution in data and map experiences.                                                                                     | Documentation and rendered UI review.                  |

## Non-functional requirements

| ID     | Requirement                                                                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | PostgreSQL/PostGIS is authoritative; Redis failure degrades performance, not correctness.                                                                   |
| NFR-02 | Coordinate order, CRS, units, bounds, and spatial predicate semantics are explicit at every interface.                                                      |
| NFR-03 | Search/pagination is deterministic for an unchanged dataset, with UUID as final tie-breaker.                                                                |
| NFR-04 | Validate and bound query radius, page size, bbox area, coordinates, request body, timeouts, and external calls.                                             |
| NFR-05 | Use parameterized SQL, least-privilege secrets, structured logs, health endpoints, and Prometheus metrics without logging credentials or sensitive headers. |
| NFR-06 | Public external services are replaceable/configurable and do not appear in deterministic tests.                                                             |
| NFR-07 | TypeScript remains strict; formatting, lint, typecheck, tests, build, and diff checks pass before completion.                                               |
| NFR-08 | Performance and scale statements cite an executed workload, dataset size, environment, date, and measured results.                                          |
| NFR-09 | The responsive UI remains keyboard-accessible, visibly focusable, and usable without relying on color alone.                                                |
| NFR-10 | New functionality includes regression tests, failure behavior, observability, documentation, and rollback/migration notes where applicable.                 |

## Change requirements

Every future feature or material fix must follow this sequence:

1. Assign or update requirement IDs and write observable acceptance criteria.
2. Identify data-contract, API compatibility, geospatial correctness, privacy/security,
   accessibility, performance, and operational impacts.
3. Update `docs/design.md` before code when a boundary, dependency, schema, state model,
   ranking formula, route contract, or failure mode changes. Add an ADR to
   `docs/decisions.md` for a durable tradeoff.
4. Define deterministic unit/contract tests and any integration, UI, migration, or load
   evidence needed to prove acceptance.
5. Implement the smallest approved slice; keep unrelated proposals out of scope.
6. Run the gates in `docs/engineering-workflow.md`, update docs and `HANDOFF.md`, and record
   only observed evidence.

## Requirements traceability template

Use this in a design/PR description or handoff for each change:

```text
Requirement IDs:
User-visible acceptance criteria:
Out of scope:
Design/ADR files:
Tests and fixtures:
Operational/migration impact:
Security/privacy/accessibility review:
Observed verification:
Rollback or disable path:
```
