# Engineering and agent workflow

This tool-neutral workflow applies whether Codex, Claude Code, a human, or another agent
implements the change. `AGENTS.md` is the shared instruction source; `CLAUDE.md` imports
it. Claude's slash commands are convenience entry points, not separate policy.

## Session lifecycle

### Start

Execute `AGENTS.md` **Mandatory session start**. Establish live Git/service state, read
requirements/design before code, distinguish accepted work from proposals, and preserve
unexpected changes. Claude Code can use `/session-start`; Codex follows `AGENTS.md`
directly. Both must inspect both instruction files for a valid import and current links.

### Plan and implement

1. **Definition of ready:** explicit user approval, requirement IDs, observable acceptance
   criteria, scope exclusions, and known risks/dependencies.
2. **Design first where needed:** update design/ADR for contract, state, dependency,
   ranking, geospatial, migration, security, or failure-semantics changes.
3. **Test strategy:** identify unit, contract, integration, UI, failure, and performance
   evidence before implementation. Never require live external services in deterministic
   tests.
4. **Small slices:** implement one coherent behavior at a time; keep interfaces narrow,
   TypeScript strict, errors explicit, and dependencies injectable.
5. **Continuous verification:** run focused tests during development, then the full gate.
6. **Documentation:** update user, operator, API, requirements, design/ADR, PLAN, and
   handoff materials in the same change.

### Definition of done

- Acceptance criteria are met and linked to tests/evidence.
- Success, invalid input, dependency failure, timeout/retry, and rollback paths are
  handled where relevant.
- CRS, axis order, units, geometry validity, bounds, and attribution are verified for
  geospatial changes.
- Security/privacy, accessibility, observability, compatibility, and operations were
  reviewed rather than assumed.
- `pnpm format:check`, lint, typecheck, tests, build, and `git diff --check` pass.
- Relevant integration/runtime smoke checks pass; measured claims include environment.
- No secret, generated artifact, stale TODO, or unrelated user change is included.
- Requirements/design/runbooks/PLAN/HANDOFF describe the implemented state accurately.

### Wrap

Execute `AGENTS.md` **Mandatory session wrap**. Claude Code can use `/session-wrap`;
Codex follows the same section directly. Update `HANDOFF.md` whenever state, validation,
decisions, blockers, services, or next steps changed. If instruction behavior changed,
review and update both `AGENTS.md` and `CLAUDE.md` plus the Claude commands in the same
change; keep shared rules only in `AGENTS.md`.

## Documentation change map

| Change                                 | Required documentation                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| User-visible behavior or scope         | `docs/requirements.md`, README, tests, HANDOFF                                        |
| API/schema/cursor/ranking              | requirements, `docs/design.md`, relevant contract/ranking docs, tests                 |
| Architecture/dependency/truth boundary | design, `docs/architecture.md`, ADR in `docs/decisions.md`                            |
| Spatial source/CRS/predicate           | requirements, design, provenance/operations docs, deterministic validation            |
| Deployment/configuration/provider      | README, `.env.example`, `docs/operations.md`, design/ADR, HANDOFF                     |
| Performance/scaling claim              | runbook, captured environment/command/result, `docs/scaling.md`; no fabricated result |
| Agent/session workflow                 | `AGENTS.md`, `CLAUDE.md`, both `.claude/commands/*`, this file                        |

## Git and review

Use focused commits with a subject and detailed body covering behavior, tests, operational
impact, and recommended next steps. Stage only intended files; inspect staged diff and
status before commit. Never force-push or write to an organization remote. A review should
trace each requirement to design and evidence, challenge failure/rollback behavior, and
reject unsupported performance or correctness claims.
