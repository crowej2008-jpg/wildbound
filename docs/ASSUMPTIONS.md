# Assumptions & open questions

Every entry says (a) what we assumed, (b) why, (c) what would change it. Combat-affecting
assumptions are also named settings in `packages/content/tuning/combat.json` (M1+, currently empty).

## M0

1. **The Python simulator is missing.** `reference/sim/battle_sim.py`, `kits.py`, `test_battle_sim.py`
   and `test_kits.py` do not exist anywhere on this machine (whole-user-profile search). The
   reference model is therefore taken from `kb/stats-and-combat.md`, `kb/pvp-arena.md` and
   `spec/combat-hypotheses-2026-10-05.md` until the owner drops the simulator into `reference/sim/`.
   Consequence: M1 parity tests (= TS twins of `test_*.py`) and `sim:golden` cannot be scripted
   against the Python files; they will encode the documented numbers + reconstructed formulas
   instead, and be reconciled when the files arrive.
2. **Reference is not committed to git.** `reference/` (~37 MB of research text) is in `.gitignore` so
   a clone stays lean and OneDrive doesn't sync 700 MB of media. Every session starts by confirming
   the reference tree exists. Any clean clone needs `reference/` restored from the owner's repo.
3. **Feature text strings are English-first through `t()`.** Localisation scaffold ships in M0
   (`packages/client/src/i18n`); only English exists. Additional locales later.
4. **`tsconfig.typecheck.json` uses DOM libs + `react-jsx` for all files** so one `tsc -p` gate covers
   engine, server, cli and client together. Node-only packages never use DOM APIs; the DOM lib being
   present is harmless and keeps the CLI a single, honest command.
5. **`pnpm check` includes a Playwright browser download on install** (postinstall). A clean clone
   needs network once for the Chromium binary; afterwards `pnpm check` passes offline (modulo new deps).
6. **The IP-guard term list lives once in `packages/cli/src/ipguard.ts`** and both the canonical suite
   (`tests/ip-guard/ip-guard.test.ts`) and `content:validate` read the same table. Only
   `ipguard.ts`/`ipguard.test.ts` are exempt from the text scan, because the guard must list the terms
   to reject.

## Carried from the reference (to be resolved per system)

- When a reference doc says `(inferred)` or `(open)`, the item becomes a named combat
  setting (Appendix A) and is surfaced in the Build Lab Rules panel.
- Conflicts between reference docs: prefer the later-dated or audited statement; record the conflict here.