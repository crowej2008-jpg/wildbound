# Rules

Every gameplay rule with its evidence level and, where applicable, its tuning setting name.
Evidence levels: **seen** (measured in the reference research), **fitted** (reference fitted it),
**inferred** (reference inferred), **open** (unsettled in the reference), **own** (our design).

This file is empty at M0 by design — M1 records the combat rules, M2+ the growth/economy tables.
The canonical combat settings table lives in `packages/content/tuning/combat.json`
(definitions in PROMPT.md Appendix A).

| Rule | Evidence | Setting | Milestone |
|---|---|---|---|
| (pre-rule) deterministic engine: seeded PRNG + injected clock | own (PROMPT §2.2) | n/a | M0 foundation, enforced from M1 |