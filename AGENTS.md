# Atlas — shared agent instructions

This file is the repository-level source of truth for Codex, Claude Code, and other
coding agents. Codex discovers `AGENTS.md` natively. Claude Code loads `CLAUDE.md`,
which imports this file. Keep durable, tool-neutral rules here instead of maintaining
two competing instruction sets.

## Mandatory session start

Before editing, installing, starting/stopping services, or acting on a prior handoff:

1. Read `AGENTS.md` and `CLAUDE.md`; confirm the latter still imports this file.
2. Read, in order: `README.md`, `docs/requirements.md`, `docs/design.md`,
   `docs/architecture.md`, `docs/decisions.md`, `docs/engineering-workflow.md`,
   `PLAN.md`, and `HANDOFF.md`.
3. Run `git status --short --branch`, `git log -5 --oneline`, and `git remote -v`.
   Preserve every unexpected or user-owned change. Never reset, overwrite, stage, or
   commit it.
4. Inspect `docker compose ps` and relevant ports before starting another stack. Do not
   stop a process unless its ownership is clear. A stack the user asked to keep available
   may remain running across sessions.
5. Check only whether `.env` and required keys exist; never display secret values.
6. Reconcile `HANDOFF.md` with the live repository and services. Treat future work in a
   handoff as proposed unless the user has explicitly approved it.
7. Summarize verified state, deviations, and the requested task before implementation.

Claude Code users may invoke `/session-start`; Codex must execute the same protocol from
this file. The command is a convenience, not a second source of truth.

## Product and architecture invariants

- Atlas is a Long Beach place-discovery vertical slice, not a general geocoder, social
  network, or full route planner.
- PostgreSQL/PostGIS is authoritative. Redis is disposable acceleration and must never
  change search truth.
- Preserve explicit WGS84 longitude/latitude handling. Use PostGIS `geography` or an
  appropriate projected CRS for metric distance; never calculate user-facing distance
  from unprojected degree units.
- PostGIS candidate pruning may use straight-line geography distance, but displayed road
  distance and its ranking component use OSRM. Label or reject fallbacks honestly.
- Search ordering remains deterministic: score, distance, then UUID. Cursor changes are
  versioned contract changes and require compatibility tests.
- The checked-in sample CSV is an offline fixture. The OSM extract and public OSRM server
  are portfolio/demo inputs, not evidence of production ownership or an SLA.
- Preserve OSM/CARTO attribution and the Long Beach boundary restriction in the UI and
  data-fetch workflow.
- Bound coordinates, radius, result limits, bounding-box area, request bodies, timeouts,
  and external-service work. Parameterize SQL; never concatenate user input.
- Do not add a search engine, microservice, Kubernetes layer, or new paid dependency
  without measured need and an approved design change.

## Required engineering workflow

Follow `docs/engineering-workflow.md` for every change. In particular:

1. Convert the request into an approved requirements delta with acceptance criteria.
2. Update `docs/requirements.md` before or with behavior changes.
3. Update `docs/design.md`, architecture, contracts, or an ADR before implementation when
   boundaries, state, ranking, data flow, dependencies, or failure semantics change.
4. Implement the smallest coherent slice. Keep TypeScript strict and dependencies
   injectable at network, database, cache, clock, and routing boundaries.
5. Add regression tests for behavior and contract changes. Tests must be deterministic
   and must not depend on live Overpass, OSRM, CARTO, or external network access.
6. Update operator/user docs, examples, PLAN, and HANDOFF in the same change.
7. Run the appropriate verification gate and report only commands actually observed.

Full application gate:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Run `pnpm test:integration` when database/API integration behavior changes and Docker is
available. Run the relevant Compose health/smoke checks for runtime or deployment changes.
Benchmarks must use representative data and record actual commands, environment, and
results; never convert a configured k6 threshold into a performance claim.

## Working and Git practices

- Make only explicitly requested or approved changes. Recommendations are not approval.
- Do not delegate or spawn subagents unless the user explicitly requests parallel work.
- Do not expose secrets, commit `.env`, generated extracts, build output, local caches,
  benchmark artifacts, or screenshots containing private information.
- Use small, reviewable changes and conventional, detailed commits. Stage only intended
  files and inspect the staged diff.
- Commit and push only when requested. Never force-push, rewrite published history, or
  touch an organization remote. The expected remote is the user's private personal repo.

## Mandatory session wrap

When the user asks to wrap, finish, close out, or prepare for compaction:

1. Inventory the session diff and any processes started during the session. Stop only
   session-owned ephemeral work; preserve a user-requested long-running app stack and
   record that choice.
2. Run the required verification for the final change, then repeat any formatter/check
   until a no-change pass. Do not claim an unrun check.
3. Update affected requirements, design/ADR, operational docs, README, and PLAN. Update
   `HANDOFF.md` with completed work, decisions, actual verification, live-service state,
   blockers, and explicit next steps.
4. Re-read both `AGENTS.md` and `CLAUDE.md`. If agent behavior changed, update this shared
   source and Claude's import/routing file in the same change. Verify both Claude command
   files and every startup/wrap documentation link still resolve. Avoid duplicating
   durable rules in `CLAUDE.md`.
5. Inspect `git diff`, `git diff --check`, `git status`, and the staged diff for secrets,
   generated files, stale claims, or unrelated changes.
6. If the user requested commit/push, create a detailed commit describing changes,
   validation, and recommended next steps; push to the configured personal upstream and
   verify local/upstream synchronization. Otherwise leave changes uncommitted and say so.
7. End with commit/push status, checks run, service status, blockers, and the exact next
   approved or proposed action. Do not create an empty commit.

Claude Code users may invoke `/session-wrap`; Codex must perform the same steps from this
file. Neither protocol grants standing approval for destructive actions or external writes.
