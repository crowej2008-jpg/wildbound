---
title: Dev environment and tooling quirks
type: project
updated: 2026-10-31
sources: [opencode-session-2026-10, README.md]
---

# Dev environment and tooling quirks

## Where the code lives
- GitHub: `github.com/crowej2008-jpg/wildbound` (made **public** on 2026-10-31; was private before).
- Owner's working copy: `C:\Users\crowe\OneDrive\Documents\Default Project\wildbound` (Windows,
  inside OneDrive). The parent `Default Project` folder holds unrelated bot/Jarvis projects.
- `reference/` (research wiki, visual screenshots, sim) is **gitignored** — it exists only on the
  owner's machine. Cloud agents can't see it.

## Commands
`pnpm install`, `pnpm dev`, `pnpm check` (lint + typecheck + test + content:validate + build + e2e),
`pnpm sim`, `pnpm content:validate`. `package.json` pins `pnpm@12.10.1`.

## Known quirks
- **PowerShell + git:** push output can show exit code 1 because git writes progress to stderr; the
  push still succeeded — verify `HEAD == origin/main`.
- **corepack/pnpm on Windows:** `pnpm --filter` sometimes failed with `pnpm-native.exe spawnSync
  UNKNOWN` (M10.2). Workaround used: run each gate directly (tsc, eslint, vitest, validator via
  `tsx`, vite build, Playwright against a manual preview).
- **Git once "missing"** (M8): the agent reported no git on PATH; commits resumed later.
- **Geometric-repack warning** on push (M13.2) is harmless.
- **OpenCode free tier:** the session ran on OpenCode's free "big-pickle" model and stopped on
  "Free usage limit reached" (2026-10-31 08:09). Long autonomous runs can die mid-step — check
  `git status` before resuming.
- **Cloud Claude sessions** may not reach the npm registry, so they can edit but not run `pnpm check`.
