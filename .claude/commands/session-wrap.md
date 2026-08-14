---
description: Execute the shared Atlas closeout, documentation, QA, and handoff protocol
allowed-tools: Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git remote:*), Bash(docker compose ps:*), Bash(pnpm format:check:*), Bash(pnpm lint:*), Bash(pnpm typecheck:*), Bash(pnpm test:*), Bash(pnpm build:*), Read, Edit, Write, Glob, Grep
---

# Atlas session wrap

Shared instructions and wrap protocol:

@AGENTS.md

Engineering workflow and documentation mapping:

@docs/engineering-workflow.md

Current handoff to update:

@HANDOFF.md

Run the **Mandatory session wrap** in `AGENTS.md` iteratively until the final documentation
and QA review produces no further edits. Review both `AGENTS.md` and `CLAUDE.md`; when
agent behavior changed, update the shared instructions and Claude routing together rather
than allowing them to drift. Commit and push only when the user explicitly requested it.
