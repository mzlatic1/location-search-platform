---
description: Execute the shared Atlas startup protocol and report verified continuation state
allowed-tools: Bash(git status:*), Bash(git log:*), Bash(git remote:*), Bash(docker compose ps:*), Read, Glob, Grep
---

# Atlas session start

Shared instructions and startup protocol:

@AGENTS.md

Current handoff:

@HANDOFF.md

Run the **Mandatory session start** in `AGENTS.md`. Validate that `CLAUDE.md` imports
`AGENTS.md`, both session command files exist, and all required documentation links
resolve. Report the live working tree, recent commits, upstream, service state, accepted
work, proposed work, and the task requested for this session. Do not implement a proposed
handoff next step without current user approval.
