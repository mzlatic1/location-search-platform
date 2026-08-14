# Atlas session handoff

**Status:** User-accepted application; documentation and cross-tool agent workflow are
complete, final wrap-up is complete, and all Docker containers are intentionally stopped.

**Last updated:** 2026-08-13 PDT

## Cross-tool session contract completed

- `AGENTS.md` is the tool-neutral instruction source Codex discovers natively.
- `CLAUDE.md` imports `AGENTS.md` so Claude Code receives the same invariants; it also
  points to canonical requirements, design, and this handoff.
- Claude Code convenience commands live at `.claude/commands/session-start.md` and
  `.claude/commands/session-wrap.md`. They route into the same mandatory protocols rather
  than defining a competing workflow.
- Startup requires both instruction files, requirements/design/workflow/current handoff,
  live Git/service inspection, user-change preservation, and approval-state review.
- Wrap requires full applicable QA, requirements/design/ADR/user/operator documentation,
  PLAN and HANDOFF maintenance, cross-tool instruction/link synchronization, secret and
  diff review, and detailed commit/push only when requested.
- `docs/requirements.md` now records functional/non-functional requirements, acceptance
  evidence, change gates, and traceability. `docs/design.md` records component boundaries,
  ranking/spatial/data/API/failure rules, evolution rules, and a future design checklist.
  `docs/engineering-workflow.md` defines ready/done gates and the documentation change map.
- README, architecture, decisions, and PLAN link or record this engineering baseline.

## Current accepted application

When started, the app at `http://localhost:3000` contains 4,485 actual named Long Beach
places. It uses CARTO Voyager, a light-blue origin, amber selection, Home control,
preloaded categories, imperial/metric display, and OSRM road-network distance.

Selection by panel, marker click, or double-click zooms consistently. The selected OSRM
road path is framed on the map and its widget reports origin, destination, road distance,
and estimated drive time. Rank score hover/focus explains the actual 55% text + 25% road
proximity + 15% popularity + 5% category formula. The user accepted the build and reported
no more critiques on 2026-08-13; do not redesign accepted behavior without a new request.

## Latest verification

Observed after the cross-tool documentation change:

```text
Prettier format check       passed
ESLint                      passed
workspace TypeScript        passed
Vitest                      14 passed
production workspace build passed
git diff --check            passed
Docker Compose smoke        API/web up; PostgreSQL and Redis healthy before shutdown
GET /health                 database=true, redis=true
GET http://localhost:3000   HTTP 200
GitHub Actions CI           run 31775462228 passed
```

## Final closeout state

On 2026-08-13, the user requested a complete shutdown and wrap-up. All 17 running Docker
containers on the host were stopped successfully, including Atlas API, web, PostgreSQL,
and Redis. `docker ps` returned no running containers afterward. Containers and persistent
volumes were not removed, so a future approved session can restart this stack with
`docker compose up -d` (or `docker compose up --build` when rebuilding is required).

No runtime code or application data changed during closeout. The final documentation-only
wrap records service shutdown and preserves the previously observed application and CI
evidence without representing the URLs as currently available.

## Next session

Execute the mandatory startup protocol in `AGENTS.md` (Claude Code may use
`/session-start`). Expect no Docker containers to be running; inspect state first and start
only the services needed for an approved task. The only known proposed portfolio work is
a representative 100K+ indexed EXPLAIN/k6 run and a real UI screenshot. Start it only
after explicit user approval, use `docs/database-indexes.md`, and record only measured
environment/commands/results. It is not required to preserve the accepted application.
