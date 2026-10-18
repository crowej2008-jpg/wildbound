# Wildbound — master prompt

OpenCode master prompt: build "Wildbound", an original web game based on the game-rebuild research.

## How to use this file (for the human)

Make a project folder and put the research and the simulator in a read-only `reference/` folder:

```
wildbound/
  PROMPT.md                      <- this file
  reference/game-rebuild/        <- the full repo (kb/, atlas/, spec/, data/, live/)
  reference/sim/                 <- battle_sim.py, kits.py, test_battle_sim.py, test_kits.py
```

Run opencode in `wildbound/`. Start in plan mode and send: "Read PROMPT.md fully. Then execute Milestone 0 only and stop."
Continue one milestone at a time (section 13). Each milestone ends with passing tests and a commit.
Don't ask for the whole game in one go; the context won't hold it.

---

## 1. Mission

Build Wildbound, a complete, playable, mobile-first web game: collect original creatures, grow them,
assemble a team of six, and watch automatic turn-based battles. It is a rebuild of the design
documented in `reference/game-rebuild` (screens, systems, economy shape, and the measured combat
model), not a copy of that game's content.

You are building:

- A headless, deterministic game engine in TypeScript (combat, growth, economy, time, rewards).
- A web client (React) with every screen listed in section 8.
- A server boundary that starts as a local in-browser implementation and can later be replaced by a real backend.
- A Build Lab tool for testing builds and new creatures with the combat simulator (this is the owner's main goal).
- Original content: about 36 creatures, skills, items, stages and tuning tables, plus procedurally generated art.

Quality bar: a stranger could open the site on a phone and play for an hour without hitting a
placeholder, a crash, or an unexplained number.

## 2. Non-negotiable rules

### 2.1 Originality and IP

The source game uses characters owned by Nintendo and The Pokémon Company. Do not use any Pokémon
names, species, move names, item names, type names, logos, art, sprites, sounds, UI art or text. Do
not copy any game text, skill description, item description or tutorial wording from the repo or from
any other game. Write all names and text yourself.

Do not draw, trace or approximate any existing franchise character. Creatures are original and
procedurally generated (section 9.4).

`reference/game-rebuild/data/h5-client/` contains the publisher's configuration dumps. Use them only
to understand formula shapes and curves. Never copy rows, ids, names or whole tables into the shipped
game. Write your own tables and tune them (section 9.5).

Do not fetch, scrape, probe or connect to any server or website belonging to the source game or any
other game. No network calls at all other than loading the app's own files. No analytics, ads or trackers.

Add the IP guard test in Appendix C and keep it green.

> **Owner override (2026-10-15).** The owner has authorised this private, never-distributed build to
> ship the Pokémon-themed roster they collected (see `docs/ASSUMPTIONS.md`). Pokémon species and skill
> names are therefore permitted in `packages/content` for this build only; every other clause in §2.1
> stands, and the IP guard (Appendix C) scopes its blocklist to the remaining franchise terms.

### 2.2 Engineering

- TypeScript strict mode everywhere. No `any` unless commented why.
- The engine is pure and deterministic: same inputs and seed give the same outputs. No `Math.random`,
  `Date.now` or `new Date()` inside `packages/engine`. Randomness comes from an injected seeded PRNG
  (mulberry32). Time comes from an injected clock.
- Everything tunable is data, not code: stats, rates, costs, drop tables, and every combat setting
  listed in Appendix A.
- Every rule you implement needs a unit test. Every rule you are unsure of goes in `docs/ASSUMPTIONS.md`
  and, if it affects combat, becomes a setting.
- Never leave TODO stubs in shipped screens. If a feature is out of scope for the current milestone,
  the screen shows a deliberate, honest "coming later" state and is listed in `docs/SCOPE.md`.
- Commit after every passing step with a clear message. Never commit failing tests.

### 2.3 Process

- Work one milestone at a time (section 13). Finish it, run all checks, summarize, then stop and wait.
- Read before writing. For each system, read the named reference files (section 3) first, then write
  a short design note in `docs/design/<system>.md` before coding it.
- Don't ask the human questions you can answer by reading the reference or by making a documented
  assumption. Ask only for taste decisions (names, art direction) and only once, at the end of a milestone.

## 3. Reference material map

Read these in this order at the start of Milestone 0 (skim, don't memorise):

| Need | Read |
|---|---|
| Repo purpose and conventions | `reference/game-rebuild/README.md`, `CLAUDE.md`, `index.md` |
| Navigation graph | `reference/game-rebuild/navigation.md` |
| Screens and flows | `reference/game-rebuild/atlas/01` to `12` |
| Combat rules (the measured model) | `kb/stats-and-combat.md`, `kb/pvp-arena.md`, `spec/combat-hypotheses-2026-10-05.md`, `live/sessions/2026-10-04-offline-mining.md` |
| Growth, stars, evolution, caps | `kb/pokemon-growth.md`, `kb/resonance.md`, `kb/lineups.md` |
| Gacha, shop, economy shape | `kb/gacha.md`, `kb/shop.md`, `kb/vip-and-spending.md`, `kb/account-boosts.md` |
| Equipment systems | `kb/held-items.md`, `kb/orbs.md`, `kb/berries.md`, `kb/soul-hearts.md`, `kb/potential.md`, `kb/artifacts.md` |
| Time and rotations | `kb/clock-and-calendar.md`, `kb/daily-routine.md`, `kb/rotations.md` |
| PvE and PvP modes | `kb/` pages for tower, trials, arena, ranked, world boss, guild |
| Reference simulator | `reference/sim/battle_sim.py`, `kits.py`, and their tests |
| Skill kit data shape | `data/h5-client/2026-10-03/skill_kits_cfg.json` (shape only) |

Wherever the reference says something is `(inferred)` or `(open)`, treat it as unsettled and make it a setting.

## 4. Tech stack, layout and commands

Language/tooling: TypeScript 5, Node 20+, pnpm workspaces, Vite, Vitest, ESLint + Prettier, Playwright for end-to-end tests.

Client: React 18, React Router, Zustand for UI state, plain CSS modules (no heavy UI kit), SVG and Canvas for art and battle effects.

Persistence: IndexedDB via `idb`, with a versioned save schema and migrations.

Optional later (Milestone 12): Fastify + SQLite backend for Arena ghosts and rankings.

```
wildbound/
  AGENTS.md                  <- you create it (section 14)
  PROMPT.md
  docs/  design/ RULES.md ASSUMPTIONS.md SCOPE.md CONTENT.md CHANGELOG.md
  reference/                 <- read-only
  packages/
    engine/                  <- pure TS, no DOM, no Date, no Math.random
      src/ rng.ts clock.ts stats.ts power.ts combat/ growth/ economy/ gacha/ pve/ pvp/ quests/ shop/ save/
    content/                 <- data + schemas (zod): species, skills, kits, items, stages, shops, quests, tuning
    server/                  <- GameServer interface + LocalServer (browser) [+ HttpServer later]
    client/                  <- React app
    cli/                     <- simulate, sweep, validate-content, golden-export
  tests/ e2e/ ip-guard/
```

Commands that must always work from the root: `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`
(Vitest, all packages), `pnpm lint`, `pnpm typecheck`, `pnpm e2e`, `pnpm sim -- <args>` (CLI
simulator), `pnpm content:validate`.

## 5. Core domain model

Use these names (they are generic mechanics, not borrowed content).

- **Wilds**: creatures. **Trainer**: the player. **Squad**: the six fighters.
- **Factions** (6): Ember, Tide, Grove, Volt, Frost, Shade. Each Wild has one faction.
- **Classes** (3): Striker (ATK career), Guardian (DEF career), Adept (SKILL career). Class sets
  starting Rage and some kit rules (section 6).
- **Quality tiers** (6): Common (green), Rare (blue), Epic (purple), Legendary (orange), Supreme
  (red), Mythic (gold). Higher tiers have higher base stats, higher level caps and unlock more
  equipment systems.
- **Stats**: HP, P.ATK, S.ATK, SPD, P.DEF, S.DEF. Each skill uses either P.ATK or S.ATK. P.DEF and
  S.DEF are display-and-Power only by default: in the measured model, main DEF has no effect on
  damage (`defendersUseDef=false`; keep it false but implement the switch so a different design can be tried).
- **Percent stats** (fractions, 1.0 = 100%): DMG Boost, DMG RDCT, PvP Boost, PvP RDCT, Ult
  Boost/Reduction, Skill Boost/Reduction, Crit, Crit Res, Crit Power, Block, Block Power, Guard
  Break, Control Boost, Control Res, Heal Boost, Receive-Heal Boost, Counter Boost.
- **Soul stats**: Spirit ATK and Spirit DEF (flat values feeding the soul factor).
- **Power**: a single number summarising a Wild's stats and percent lines, and the sum over the six
  squad members for team Power. Read the Power section of `kb/stats-and-combat.md` (the repo says its
  formula is solved exactly) and implement it on this game's stat names. Record the formula in
  `docs/RULES.md`. If the reference formula can't be reconstructed, define your own weighted sum and
  note the deviation.
- **Entities**: `Account` (trainer level, XP, VIP, currencies, bag, roster, squads, saves, timers),
  `WildInstance` (species, level, stars, evolution, potential tree choices, equipment, locked flag),
  `Squad` (6 slots in positions 1 to 6, team-wide strategy, emblem set), `Equipment` items, `Stage`,
  `Mode`, `Quest`, `Shop`, `Mail`.

## 6. Combat engine specification

Port `reference/sim/battle_sim.py` and `kits.py` to `packages/engine/src/combat`. This section
restates the model. Where it differs from the Python, the Python is the reference unless you find a
bug, in which case fix both and note it in `docs/CHANGELOG.md`.

### 6.1 Battle shape

- 6 v 6. Positions 1 to 3 are the back row, 4 to 6 the front row. Columns: {1,4}, {2,5}, {3,6}.
- Up to `maxRounds` (default 15) big rounds. Each big round, all living units act once, ordered by
  SPD descending; ties break by side (attacker first) then position (assumption, setting `tieBreak`).
- A frozen/stunned unit skips exactly one of its turns, gains no action Rage, and does not stack or
  refresh (a live control cannot be reapplied); immunity blocks guaranteed controls.
- Winner: attackers win only if every defender is dead by the end of round `maxRounds`; otherwise the
  defender wins (time-out).
- Output a full event log (see 6.8). The UI replays from it; the engine never touches the DOM.

### 6.2 Targeting

- Single-target normal attacks and basic skills: the front-row unit in the attacker's own column; if
  dead, the nearest front column (ties to the lower column); if the front row is empty, the back row
  by the same rule.
- Multi-target skills: the same ordering, taking the first N targets; skills may specify
  `rule: "lowest_hp"` or `rule: "row"` (all enemies in the first target's row).
- Skills may carry per-hit rates (e.g. 185% to the first target, 135% to the next two).

### 6.3 Rage and skill choice

- Rage bar max 1000. Starts at 500 for Guardians and Adepts, 1000 for Strikers (so a Striker's first
  action is its ultimate).
- Normal attack or basic skill: attacker +250 Rage. Ultimate: costs 1000 (set to `max(0, rage − 1000)`).
- Being hit: target gains `125 + floor(1000 × damage ÷ target max HP)`.
- On its action: if Rage ≥ 1000 and it has an ultimate, cast it. Otherwise a basic skill replaces the
  normal attack with probability `basicReplace` (default 0.20). Otherwise a normal attack.
- Trait support (data-driven): extra Rage when hit; a chance to cut the attacker's Rage by 1/8 when
  hit; faster or slower Rage rules per class.

### 6.4 Damage pipeline (per hit)

```
atk   = skill.type == "P" ? P.ATK : S.ATK                 // attack is exactly proportional
raw   = atk * rate
G     = max(gFloor, 1 + atk.DMGBoost - tgt.DMGRDCT)       // additive
P     = pvp ? max(pFloor, 1 + a.PvPBoost - t.PvPRDCT - pvpConst) : 1
K     = ult ? 1 + a.UltBoost - t.UltRed
        : basic ? 1 + a.SkillBoost - t.SkillRed : 1      // its own factor per damage type
Soul  = 1 + soulCap * x / (|x| + soulHalf)                // x = a.SpiritATK - t.SpiritDEF, cap 0.266, half 80000
Team  = min(1, (ownPower/enemyPower) / tpThreshold)       // only the weaker attacking side is cut (setting tpSymmetric)
dmg   = raw * G * P * K * Soul * Team * classMult(a,t)    // classMult is a setting, default 1
crit:  chance = a.Crit <= t.CritRes ? critFloor : clamp(critSlope*(a.Crit - t.CritRes), critFloor, 1)
       mult   = max(critBaseMult, critBaseMult + a.CritPower - 0.5*t.CritRes)
block: chance = piecewise-linear over (t.Block - a.GuardBreak) through blockPoints
       kept   = max(0, blockKeep - blockIntScale * t.BlockPower)
percent-of-max-HP skills: dmg = share * target.maxHP, ignoring every factor above
final = max(1, floor(dmg)), then min with target current HP
```

Crit and block roll independently with the seeded PRNG. Controls and healing follow 6.5 and 6.6.

### 6.5 Controls and status

- Guaranteed controls (no stated chance) ignore Control Res entirely; only an immunity buff stops them.
- Stated-percent controls land with `min(1, max(0, chance * (1 - (target.ControlRes - attacker.ControlBoost))))`.
- Hard controls cost exactly one turn. A control applied on the holder's own turn does not count extra.
- Timed stat buffs and debuffs: same tag refreshes its duration and never stacks; stacking buffs
  (cap N) carry their own tag per stack. Durations tick down at the end of the holder's own turn
  (setting `buffTickTiming`).
- Non-control debuffs (speed down, DMG RDCT down) are modelled as timed stat modifiers on the target.

### 6.6 Sustain and special rules

- Heal = `base% × max HP × (1 + healer's Heal Boost) × (1 + target's Receive-Heal Boost)`.
  Setting `healBasis` to switch between "target max HP" and "healer attack".
- Shields absorb damage first; a shield-absorbed hit still counts for Rage (setting).
- Counter-style reflect: an ultimate may carry `counter: true`: after the base hit, apply a separate
  HP change of `floor(counterShare × HP the caster lost in the previous big round × (1 + counterBoost))`
  to every target hit, ignoring all other factors, crit, block and shields; none in round 1.
  Default `counterShare = 0.75`.
- Periodic immunity (e.g. immune 3 rounds out of every 6, starting round 1).
- Per-turn ally buffs that stack to a cap (e.g. +3% DMG RDCT per stack to all allies, cap 4).
- Weather: a mode can apply a +30% damage buff to one faction. Implement as a battle-level modifier.

### 6.7 Data-driven skill kits (DSL)

Skills and talents are JSON in `packages/content/kits`, validated by zod, and executed by the engine.
Required fields: `slot` (normal|basic|ult), `type` (P|S), `rates[]`, `rule`, optional `hpShare`,
`control {kind, chance|null}`, `selfBuffs[]`, `targetDebuffs[]`, `counter`, `heal`, `shield`.
Talents: `statMods[]`, `turnHooks[]` (named, registered in code), `rageOnHit`, `rageCutChance`,
`safeguard {active, cycle}`.

Appendix B shows a complete example kit. Every kit needs a test that checks its documented numbers.

### 6.8 Event log

Append-only list of typed events: `roundStart`, `action {unit, skill}`, `hit {src, tgt, dmg, crit,
blocked, hpAfter}`, `reflect`, `heal`, `shield`, `buffApplied/Expired`, `control {tgt, kind, landed}`,
`rageChange`, `death`, `immunity`, `roundEnd`, `result`. The client animates from these. Include a
stable `battleId` and the seed so any battle can be replayed exactly.

### 6.9 Parity tests with the Python reference

- Port every test in `reference/sim/test_*.py` to Vitest with the same numbers.
- Add `pnpm sim:golden`: a script that runs the Python simulator with crit, block and random controls
  disabled over at least 200 generated team pairs and writes JSON; a Vitest suite reproduces each
  outcome (winner, rounds, per-unit damage) exactly in TS.
- Randomised behaviour (crit rate, block rate, stated-percent controls, basic-skill replacement,
  Rage III cut chance) is tested statistically over 20,000 trials with stated tolerances, not by
  matching the Python RNG.

### 6.10 Open combat questions

Implement every unsettled item from `kb/stats-and-combat.md` as a named setting in
`packages/content/tuning/combat.json` with the defaults in Appendix A, and show them in the Build Lab
settings panel. Never hard-code a guess.

## 7. Game systems specification

For each system: read the named reference, write `docs/design/<system>.md`, then build with tests.
Numbers below are shapes and rules; write your own balanced tables.

### 7.1 Wilds, growth and evolution

- Level up costs XP Candies and Gold (Gold about 3 × the candies). Level 1 to 2 costs about 48
  candies. Costs rise smoothly; design the table and keep it in `content/tuning/growth.json`.
- Level caps are set by the evolution stage: 60, 80, 100, 140 (four stages), with evolution requiring
  a material cost, a minimum level and a minimum star count.
- Stars: each Wild has a star rating. Duplicates and shards raise it. Stars multiply base stats and
  unlock higher caps; an evolution needs a minimum star count.
- Link Crystal (the "resonance" idea): beyond level 340 growth is shared. The crystal's cap rises by
  8 per Wild at 12 stars or more. Implement as an endgame system in Milestone 8; before that the
  level cap is the stage cap.
- Respawn (reset) and rewind refuse a Wild that is in a squad, locked, has a talent tree developed
  or wears Relics. Respawn returns most invested XP and gold.
- Stat formula (you design it, document it):
  `stat = base[species][stat] * levelCurve(level) * starMult(stars) * qualityMult(tier) * evolutionMult(stage) + flat bonuses`,
  then percent lines from equipment.

### 7.2 Squads and positions

- One squad group of 6 per mode family (Campaign, Arena attack, Arena defence, Tower, and so on),
  with the same Wild allowed in several groups but never twice in one (one per species).
- Auto Formation: from eligible Wilds, pick the strongest by Power (tie-break: stars, then level,
  then id), up to six; keep saved members that are still eligible; fill the free slots; then re-sort
  positions so Guardians sit in the front and the rest strongest-first by part. Confirm saves.
- Team-wide strategy (a choice of two or three presets that change basic-skill rate or target
  preference, your design) and emblems (a trainer-level set that adds team-wide stat lines).
- Position matters: slot choice changes who gets hit and who is hit by multi-target skills.

### 7.3 Equipment systems (original names)

Implement them as five layers, each its own screen tab on the Wild screen, and keep each unlock gated
as the reference describes:

- **Relics** (held items): only Supreme quality and above can wear one; only items of the Wild's
  class show in the picker; moving a worn relic asks first; each relic levels up and can be refined.
  27 designs across five quality levels; each gives stat lines and one conditional effect.
- **Runes** (orbs): several sockets per Wild, four colour qualities, levels 1 to 6; rune sets give a
  3-piece bonus; a Wild can swap runes freely at no cost.
- **Charms** (berries): consumables with four tiers (Common, Basic, Intermediate, Greater); the
  Commons have fixed effects and no stars; higher tiers level with stars. Examples: flat HP or ATK
  in battle, a shield equal to a % of S.ATK, a DMG Boost line.
- **Spirit Cores** (soul-hearts): 12 sets × 6 sockets × 4 qualities (2 to 5 stars). Opens when a Wild
  reaches 10 stars. Each set has a 2-piece, 4-piece and 6-piece battle skill that only acts during
  fights (examples of the shape: a permanent +10% damage multiplier, +15% ATK from turn 3, a stacking
  damage-taken penalty on the enemy, +2% DMG reduction per turn up to 20%, +20% DMG RDCT in round 1).
  Their stats feed the soul factor.
- **Talent tree** (potential): nine tiers × three options per tree, per Wild, for Legendary and
  above. Options are in-battle effects and stat lines that act in fights but are not on the stat
  sheet. Resetting a tree costs gems and refunds the materials. Build 15 shared tree templates from
  reusable blocks.

All five layers must flow into the stat/percent sheet the engine uses, and every line has a unit test
showing it changes a battle outcome in the intended direction.

### 7.4 Economy and currencies

- Currencies: Gold, Gems (premium), XP Candies, Ascension Stones, Summon Tickets (common and
  premium), Arena Tokens, Guild Coins, Home Coins, and per-mode tokens. Design the sources and sinks
  in `docs/design/economy.md` and a spreadsheet-like `tuning/economy.json`.
- Idle/AFK income: accrues per minute from the best campaign stage cleared, capped at 12 hours; a
  "Claim" button grants it; a quick-collect option spends gems for 2 hours of income, with a daily limit.
- No real money. Include a fake "shop" with a gem purchase screen that is clearly a prototype and
  grants nothing real, or omit it. Never add payment code.
- VIP: a progression from spending-equivalent points (earned in-game from a daily mission, for the
  prototype) that grants daily extras and extra challenge counts.

### 7.5 Summoning (gacha)

- Two machines. Common: costs one common ticket a draw (10 for a ten-draw), 5 free draws a day, adds
  1 credit per draw, a credit box every 100 credits. Premium: one premium ticket (or 180 gems; 1,620
  for ten) per draw, 1 free draw a day, adds 20 premium credits per draw to fund a box every 20
  draws, and a pity counter of 1,000 credits that guarantees a Legendary or better.
- A single draw uses a free draw if one remains, then a ticket, then gems (Premium only). A ten-draw
  uses 10 tickets, then gems.
- A featured-target "wish" picks which Wild is boosted within its tier.
- Rates live in `tuning/gacha.json`; implement rates, pity, wish and the guaranteed-tier rule with
  deterministic seeded draws and tests (pity triggers at the exact count; ten-draw guarantee holds;
  credits add correctly).
- Show rates, pity progress, history and a summon animation. Always show real probabilities in the UI.

### 7.6 Campaign, idle and PvE modes

- Campaign: chapters of stages with enemy squads, first-clear rewards and repeatable idle gains. Star
  ratings by rounds taken. Auto-battle at 1×, 2×, 4×, and "skip to result".
- Tower: an endless-floor tower with weekly resets and milestone rewards.
- Trials (five to six): a set of tower and dungeon style modes, each with a different rule (a
  faction-locked tower, a no-ultimate trial, a stat-capped trial, a timed-survival trial, a
  weekday-rotating boss). Each gets its own entry card and reward preview.
- World Boss: a daily-rotating boss with a damage-ranking leaderboard against ghost records.
- Daily dungeons: per weekday material runs.
- Enemy squads are generated from stage definitions and scaled by a difficulty curve.

### 7.7 PvP and ranking

- Arena (async): a player sets an attack squad and a defence squad. Each day: 5 free challenges,
  extra purchasable with gems. Each refresh shows 3 opponents of similar strength from a pool of ghost
  snapshots (real defence squads saved from the local roster at save time plus generated bots). Win
  adds Arena Credits, loss deducts; credits decide rank; battles last up to 15 rounds and attackers
  must win in time.
- Weekly settlement every Monday 00:00 UTC pays rank rewards (design 8 to 10 rank bands) and resets
  credits by rank. The settlement is delivered by Mail.
- Ranked ladder: seasons with a "weather" buff for one faction (+30% damage). Implement with bots and
  ghosts; real players come with the backend later.
- Defence snapshots update when the player saves the defence squad (setting: or on fight/re-login;
  start with "on save" and note it).

### 7.8 Social and live content (Milestone 11 or stubs)

- Guild: create/join a local guild of bots, guild donation, guild shop, guild boss. Without a server
  this is simulated; mark simulated content clearly in the UI.
- Events: a rotating event calendar with 3 to 4 simple events (a collection event, a boss rush, a
  spending-free sign-in). All driven by a content-defined calendar and the injected clock.

### 7.9 Quests, mail, shops, time

- Time: all game time is UTC. Daily reset at 00:00 UTC. The Daily Shop restocks at 00:00, 12:00 and
  18:00; Forest and Island style shops at 00:00; guild shop weekly; PvP shop monthly. Show a
  countdown for each. The server clock comes from the `Clock` interface; a debug panel can fast-forward it.
- Daily quests: a list with an Activity chip, a progress bar and Go / Claim / Claimed buttons;
  Activity points unlock bonus chests. Achievements and an event calendar as tabs.
- Mail: system mail with attachments (rewards, settlements), expiry, claim-all.
- Shops: item stock with limits, restock timers, currency prices, and a one-time purchase flag.
- Tutorial: a short guided first session (summon, level up, set squad, win the first stage) with
  skippable steps.

### 7.10 Build Lab (the owner's main goal)

A first-class screen and CLI:

- Pick any Wild or kit (including an unreleased "draft" kit) and any equipment/talent loadout;
  choose an opponent set (stage squads, stored arena ghosts, or hand-built dummies).
- Run N seeded battles and report win rate, mean damage, rounds, and per-unit damage with 95%
  confidence intervals.
- Sweeps: vary one parameter across a range (a stat line, a relic, a rune set) and plot win rate;
  compare builds side by side.
- A Rules panel exposes every combat setting from Appendix A so assumptions can be changed and results re-run.
- A Kit editor (form + JSON view) with live validation and an instant 1v1 and 6v6 test; drafts are
  saved separately and never mixed into the shipped content.
- Export/import builds and sweeps as JSON; `pnpm sim` runs the same thing headlessly.

## 8. Screens and navigation

Mobile portrait first (design at 390×844; scale up to tablet and desktop with a centred phone-shaped
column and optional side panels). Build every screen below. The bottom nav has five tabs: Home,
Wilds, Combat, Summon, More.

- **Boot and title**: loading bar, title with Start and Settings, server/region picker (cosmetic),
  notice modal, post-login promo cards (dismissible), then Home.
- **HUD** (persistent): top-left player card (avatar, level, name, VIP badge, trainer XP bar, server
  clock in UTC); top strip of currency pills with plus buttons; red-dot indicators on tabs and
  buttons wherever there is something to claim.
- **Home (town)**: a stylised town with building hotspots (Guild, Shop, Quests, Mail, Idle Camp,
  Arena), an AFK reward pill, event icons.
- **Wilds**: a roster grid with filters (faction, class, tier, owned) and sort; a Wild detail screen
  with tabs Upgrade, Equip, Evolve, Runes, Spirit Cores, Talents, a stat sheet with Power, star row,
  lock and respawn buttons.
- **Squad editor**: six-slot formation grid (back row top, front row bottom), drag and drop, Auto
  Formation, emblems, strategy, team Power vs. the target's Power with the cut warning.
- **Combat hub (Explore map)**: campaign progress, pins for Trials, PvP, World Boss, Daily Dungeons,
  Guild Battles, Events; a map that scrolls.
- **Campaign**: chapter/stage list, enemy preview, rewards, star ratings, Challenge / Sweep.
- **Trials**: a vertically scrolling stack of coloured cards, each with a title, rewards preview,
  tagline, help button and red dot, then each mode's own screen.
- **PvP hub**: cards for Arena, Ranked, Championship (stub), each with a reward preview and status
  chip; Arena: three opponent cards (power, rank), refresh, remaining attempts, Defence Squad button,
  battle log, ranking list, reward list.
- **Battle screen**: isometric-style or flat 6v6 field, HP and Rage bars, status icons, "Turn N/15",
  total damage meters, speed control, skip, auto/manual ultimate toggle (optional), pause, and a
  replay-from-log engine with simple animated effects (projectile, burst, freeze overlay, shield,
  heal numbers, crit pop, block icon).
- **Result panels**: win/lose banner, rewards, damage breakdown per unit, "view log", retry/next.
- **Summon**: two machines, pity bar, wish selection, rates sheet, history, a draw animation, a
  result grid with a "new" badge.
- **Shop**: tabs (Daily, Forest, Island, Guild, PvP, Wilds), countdown, buy confirmation.
- **Quests**: Daily / Achievements / Event Calendar tabs, activity chest bar.
- **Mail**, **Settings** (audio, language, speed default, data export/import, delete save),
  **Help/Guide**, **Rankings**, **Event hub**.
- **Build Lab and Debug**: reachable from More. The Debug panel (hidden behind a setting) grants
  currency, fast-forwards the clock, and seeds the PRNG.

Every screen has: loading, empty and error states; keyboard and screen-reader support; reduced-motion
handling; and responsive layout.

## 9. Content specification

### 9.1 Roster

Author 36 original Wilds (6 per faction), covering the three classes and all tiers, in
`content/species/*.json`. Each has: id, display name, faction, class, tier, evolution line (1 to 3
stages), base stats, one normal, one basic skill, one ultimate, one to three talents, a short
original description and a palette seed. Names must be your own invention and pass the IP guard test.

### 9.2 Kits

Write each kit in the DSL (6.7). Give each class a clear identity:

- Strikers: high Rage start, strong ultimates (single-target burst, row sweeps, lowest-HP hunters).
- Guardians: low-damage, high-HP, damage reduction, counters, ally shields, safeguards, Rage manipulation.
- Adepts: controls, debuffs (speed down, DMG RDCT down), heals and team buffs.

Include at least: one counter-style Guardian (original, mirrors the reflect rule), one
guaranteed-freeze Adept, one stated-chance control Adept, one healer, one shield support, one
lowest-HP hunter, one row sweeper, one %max-HP skill user, and one periodic-immunity tank.

### 9.3 Items

Author original items for every equipment layer (27 relics, 12 rune sets, 12 Spirit Core sets with
their 2/4/6 skills, 19 charms, the shared talent blocks), plus consumables and currency items, all in
`content/items/*.json` with ids, names, icons (procedural), text and stats.

### 9.4 Art and audio (all original and procedural)

- Creatures: a seeded SVG generator in `client/art/` that builds each Wild from a few body templates
  per faction, with colour palettes, eyes, limbs, markings, evolution-stage scaling and quality-tier
  auras. Same seed gives the same creature. Provide a gallery screen to review all 36 at every stage.
- UI icons: generated SVG or CSS shapes with consistent stroke style; items get a quality-coloured frame.
- Backgrounds: gradients and simple procedural scenery per mode.
- Audio: WebAudio-synthesised effects and a simple generated loop; all mutable, off by default until
  the first tap.
- No external images, fonts (use a system font stack), sounds or icon packs.

### 9.5 Tuning

Create `content/tuning/*.json` for growth, economy, gacha, combat settings, stage scaling and PvP
rewards. Calibrate shapes against the reference (for example the share of damage a Striker's ultimate
contributes, the relative size of equipment lines, and the pity counts), but write your own numbers
and keep a short rationale in `docs/design/balance.md`. Include a balance report script that
simulates 1,000 battles between archetype squads and prints win-rate matrices by faction and class;
fail the build if any single Wild's win rate across the matrix goes outside an agreed band.

## 10. Persistence, time and the server boundary

Define `GameServer` in `packages/server` as an async interface with one method per action (for
example `claimIdle()`, `levelUp(wildId)`, `summon(machine, count)`, `startBattle(mode, squadId)`,
`saveSquad(...)`, `arenaRefresh()`, `buyShopItem(...)`). The client calls only this interface.

`LocalServer` implements it in the browser using the engine and IndexedDB. Every method validates
inputs and returns typed results or typed errors (insufficient items, level cap, locked, and so on).

All randomness and rewards are decided inside `LocalServer/engine`, never in React components.

Saves are versioned (`schemaVersion`), migrated on load, auto-saved after each action, exportable and
importable as JSON, with a corruption check and a one-step backup.

Offline progress (idle) is computed from stored timestamps against the injected clock, capped at 12 hours.

A later `HttpServer` must be a drop-in replacement; write the OpenAPI-style spec in
`docs/design/server-api.md` as you go.

## 11. UI/UX and rendering requirements

- Visual language: clean, saturated, readable; a consistent token set (colours per faction and per
  tier, spacing, radius, type scale) in one CSS file; light and dark modes.
- Numbers formatting: 1.2K / 3.4M / 5.6B with exact values in tooltips; countdowns in `1D 02:23:40` style.
- Performance: 60 fps on a mid-range phone during battle with 12 units and effects; first load under
  1.5 MB gzip excluding generated art; route-level code splitting; the engine can run in a Web Worker
  for Build Lab sweeps.
- Accessibility: WCAG AA contrast, focus rings, ARIA labels on icon buttons, no information by colour
  alone, reduced-motion respected.
- Localisation scaffold: all strings through a `t()` function with an English file; do not hard-code
  UI text in components.

## 12. Testing and quality gates

- Unit (Vitest): every engine rule, every kit, every shop/gacha/economy function; target at least 90%
  line coverage in `packages/engine`.
- Property tests (fast-check): damage is monotonic in attack; adding DMG Boost never lowers damage;
  the winner is deterministic for a seed; no negative currency; save/load round-trips.
- Golden and parity tests: section 6.9.
- Content validation: `pnpm content:validate` checks schema, unique ids, referenced items exist, every
  Wild has a complete kit, every stage's squad is legal, no empty strings, and the IP guard.
- E2E (Playwright): boot, tutorial, summon, level up, set squad, win a stage, claim idle, buy from
  shop, run an Arena fight, open Build Lab and run a 100-battle sweep, export and re-import a save.
  Run on a mobile viewport and a desktop viewport.
- CI script `pnpm check` runs lint, typecheck, unit, content validation, build and e2e. It must pass
  before every milestone is declared done.

## 13. Milestones (execute strictly in order; stop after each)

- **M0 — Foundations.** Read the reference. Create the workspace, tooling, folder layout, AGENTS.md,
  empty docs, the IP guard test, `pnpm check`, and a hello-world client. Write `docs/SCOPE.md` mapping
  every system in section 7 to a milestone. Done when: `pnpm check` passes on a clean clone.
- **M1 — Combat engine.** Port the simulator, the event log, the DSL, and all tests; golden parity;
  CLI `pnpm sim`. Done when: every Python test has a TS twin, golden parity passes, and statistical
  tests are green.
- **M2 — Content core.** Species schema and 36 Wilds, kits for all of them, the stat formula, Power,
  tuning files for growth, and the content validator. Procedural creature generator with the gallery
  screen. Done when: the gallery shows all Wilds at all stages and `content:validate` passes.
- **M3 — Account, roster, growth, squads.** LocalServer, saves, level/star/evolve, squad editor with
  Auto Formation, Wild screen (Upgrade/Evolve tabs), HUD. Done when: a new player can summon via a
  debug grant, level a Wild, evolve it and save a squad, reload, and see the same state.
- **M4 — Battle UI.** Battle screen replaying from the event log with effects, speed control, result
  panels, damage breakdown. Done when: a recorded battle replays identically on every run and the 60
  fps budget is met.
- **M5 — Campaign, idle and daily loop.** Campaign chapters, auto-battle, idle income, quests, mail,
  the clock and reset logic, tutorial. Done when: a player can play from first launch to chapter 3
  with a working daily loop.
- **M6 — Summoning and shops.** Both machines, pity, wish, history, shops with restock timers,
  currency sources and sinks. Done when: gacha tests prove exact pity and guarantees and shop timers
  match the UTC schedule.
- **M7 — Equipment layers.** Relics, Runes, Charms, Spirit Cores, Talent trees, their screens, and
  their effect on battles. Done when: each layer has tests proving its lines change outcomes and the
  UI shows the stat deltas ("preview power").
- **M8 — Trials, Tower, World Boss, Link Crystal.** All PvE modes with their special rules and the
  endgame growth system. Done when: each mode is playable with rewards and weekly resets.
- **M9 — Skill kits.** Expand the combat DSL with the primitives the imported kits need
  (ally-targeted buffs, ATK/DEF debuffs and ignore-DEF, %-HP and true damage, the full control suite,
  cleanse/dispel/immunity, rage generation/steal, stacking and cooldowns, reactive triggers,
  per-creature resource counters), then port all 84 creatures' kits faithfully from the owner's
  skills sheet and re-tune balance. Done when: every creature's kit validates against the extended
  schema, the port is complete, and `pnpm check` is green.
- **M10 — PvP.** Arena with ghosts and bots, three-opponent matchmaking, daily attempts, weekly
  settlement via Mail, the ranked ladder with weather, rankings and rewards. Done when: a simulated
  week of play produces a correct settlement.
- **M11 — Growth and collection layers II.** The held/collection systems beside the M7 equipment:
  Potential, Orbs, Soul-hearts, Plates, Trinkets, Held Items, Resonance, Berries, VIP/privileges and
  titles. Done when: each layer has tests proving its lines change outcomes, its screen exists, and
  every unbuilt hook shows an honest "coming later" state.
- **M12 — Ancient Artifacts and Suppression.** The artifact collection (Mythic/Supreme pairs), Relic
  Tablets and the other upgrade materials, the Suppression stat that ties artifact power to mode
  strength, and Ruins Adventure (the artifact material run). Done when: artifacts activate and level,
  and Suppression is applied where the reference applies it.
- **M13 — Explore modes.** Hoopa's Vault (route runs and the exit guardian), Rift Arena (barriers,
  arena, recruit, merchant), Gods Trials, Sky Pillar, Faction Tower, Misty Woods (runes), Pet Home,
  Island Challenge, Ultra Wormhole. Done when: each is playable with rewards and resets.
- **M14 — Combat and co-op modes.** Victory Road (the eight gym regions) with King's Trial, Collection
  and Hall of Fame; Paradise (season, explore, dex, shop); Joint Team with Dynamax and the Wild Area;
  Clash of Isles; Shovel Carnival. Done when: each is playable end to end.
- **M15 — Guild, merge and events (simulated).** Guild (create/join against bots, donation, shop,
  boss, packet, auction), the merge event, the rotating event calendar (Sign-In, Weekend Bash, Golden
  Egg, Flower Event, Miracle Roulette, Adventure Event), and the PvP/daily shop restock schedules.
  Every simulated feature is labelled. Done when: nothing in the app is a dead button.
- **M16 — Guild war and Relic Battlefield.** The guild stronghold war: the tiled map, capture and node
  scoring, stamina, guard teams with carried-over HP, shields, seasons, season quests and the seasonal
  artifact. Depends on M12 (artifacts/Suppression) and M15 (guild/merge). Done when: a season can be
  played against bot guilds and settled.
- **M17 — Cross-server PvP.** Cross-Server Clash, Championship / World Championship and SPT Temple,
  bot-driven until the backend lands. Done when: each is playable and its rewards settle.
- **M18 — Visual-identity pass.** Original 2D sprites (image where supplied, procedural SVG fallback)
  under `packages/client/public/art/`, a UI restyle to the measured source palette, and the full
  battle-effects layer. Done when: the game matches the reference's look and feel.
- **M19 — Hardening and backend (the shared service, now required).** Accessibility audit, performance
  pass, save migrations, error reporting to console only, docs, and the Fastify + SQLite `HttpServer`
  (accounts, real matchmaking/ghosts, rankings, settlement jobs) with a deployment guide. Done when:
  `pnpm check` is green, Lighthouse mobile scores are 90+ for performance and accessibility, and the
  backend passes the same e2e suite for a small private group.
- **M20 — Build Lab (last).** The full tool from 7.10, the Rules panel, the kit editor, sweeps with
  confidence intervals, CLI parity. Done when: the owner can create a draft Wild, set a loadout, run
  a 1,000-battle sweep and export the result.

## 14. Working agreement for OpenCode

Create `AGENTS.md` at the root with: the mission, the rules in section 2, the commands in section 4,
the milestone list, and a rule that you must read `docs/SCOPE.md` and `docs/ASSUMPTIONS.md` at the
start of each session.

For each milestone: (a) re-read the relevant reference files, (b) write or update the design note,
(c) write tests first for new engine rules, (d) implement, (e) run `pnpm check`, (f) update
`docs/CHANGELOG.md`, `docs/SCOPE.md`, `docs/ASSUMPTIONS.md`, (g) commit, (h) print a short report:
what was built, what is assumed, what is open, how to try it, and stop.

If a reference doc conflicts with another, prefer the later-dated or audited statement and note the
conflict in `docs/ASSUMPTIONS.md`.

If you discover a bug in `reference/sim`, do not edit the reference; copy the fixed logic into the
engine and document the difference.

Keep files small and focused (aim under 300 lines); extract helpers rather than growing a file.

Never delete tests to get green. Never weaken a threshold without recording why.

## 15. Definition of done (whole project)

- All milestones M0 to M20 complete (the M19 backend is required — see `docs/SCOPE.md`).
- `pnpm check` is green on a clean clone, and `pnpm build` produces a static site that runs from any
  static host.
- A new player can complete the tutorial, build a squad, win campaign stages, summon, equip, climb
  the Arena, and use Build Lab, with no console errors.
- All shipped text, names, art and audio are original and the IP guard passes.
- `docs/RULES.md` documents every combat and economy rule with its evidence level and its setting
  name; `docs/CONTENT.md` documents how to add a Wild, a kit, an item and a stage.

## Appendix A — Combat settings (all live in content/tuning/combat.json)

| Setting | Default | Meaning / status in the research |
|---|---|---|
| `mode` | "pvp" | PvP applies the P factor |
| `maxRounds` | 15 | time-out goes to the defender (seen) |
| `gFloor`, `pFloor` | 0.1, 0.1 | where G and P stop falling (open) |
| `pvpConst` | 0.0 | extra constant in P (0.12 fitted for DEF-class attackers; open) |
| `soulCap`, `soulHalf` | 0.266, 80000 | soul factor (fitted) |
| `critFloor` | 0.03 | seen |
| `critSlope` | 1.0 | notes disagree: 1.0 vs about 1.2 (open) |
| `critBaseMult` | 1.2 | PvP crit multiplier (inferred; 1.59 in PvE) |
| `blockPoints` | [(-0.40, 0.03), (0.50, 0.50), (1.00, 1.00)] | block chance by (Block − Guard Break) (inferred) |
| `blockKeep` | 0.80 | share of damage kept by a blocked hit (inferred) |
| `blockIntScale` | 0.0 | how much Block Power cuts a blocked hit (open) |
| `tpThreshold` | 0.70 | team-Power cut starts between 0.66 and 0.77 (open) |
| `tpSymmetric` | false | does a weaker defender also deal less (open) |
| `classMult` | none | class and faction terms (open; ×1.113 and ×1.174 across class, ×1.43 across factions were measured but unexplained) |
| `basicReplace` | 0.20 | seen |
| `rageStart` / `rageMax` | 500 / 1000 | Strikers start full (seen) |
| `ragePerAction`, `rageHitBase` | 250, 125 | seen |
| `counterShare` | 0.75 | reflect share of last round's HP lost (seen) |
| `tieBreak` | attacker side, then position | assumed |
| `buffTickTiming` | end of holder's own turn | assumed |
| `defendersUseDef` | false | main DEF has no effect on damage (seen) |
| `healBasis` | "targetMaxHp" | open |

## Appendix B — Example kit (original; counter-style Guardian)

```json
{
  "id": "tidewarden",
  "name": "Tidewarden",
  "faction": "Tide",
  "class": "Guardian",
  "tier": "Mythic",
  "skills": {
    "normal": { "type": "S", "rates": [1.0], "rule": "column",
      "selfBuffs": [{ "tag": "ripple", "field": "dmgRdct", "amount": 0.15, "turns": 2 }] },
    "basic":  { "type": "S", "rates": [1.2], "rule": "column",
      "selfBuffs": [{ "tag": "surge", "field": "dmgRdct", "amount": 0.15, "turns": 2 }] },
    "ult":    { "type": "S", "rates": [1.6], "rule": "row", "counter": true }
  },
  "counterShare": 0.75,
  "talents": {
    "statMods": [
      { "field": "hp", "mult": 1.25 }, { "field": "spAtk", "mult": 1.25 },
      { "field": "crit", "add": 0.06 }, { "field": "critRes", "add": 0.38 },
      { "field": "critPower", "add": 0.06 }, { "field": "block", "add": 0.09 },
      { "field": "blockPower", "add": 0.09 }, { "field": "guardBreak", "add": 0.08 }
    ],
    "rageOnHit": 125,
    "rageCutChance": 0.5,
    "safeguard": { "active": 3, "cycle": 6 },
    "turnHooks": ["allyShelterStack"]
  },
  "hooksConfig": { "allyShelterStack": { "field": "dmgRdct", "amount": 0.03, "cap": 4 } }
}
```

Required tests for this kit: reflect equals `floor(0.75 × previous-round loss × (1 + boost))` on every
row target, none in round 1, immunity rounds are 1-3, 7-9 and 13-15, ally stacks stop at 4, the buff
refreshes and never stacks, and the Rage-cut chance converges on 50%.

## Appendix C — IP guard test

Create `tests/ip-guard/ip-guard.test.ts`. It recursively scans `packages/content`, `packages/client/src`
(excluding the guard test itself) and any generated text for these strings, case-insensitively, and
fails on any match:

```
pokemon, pokémon, pikachu, charizard, charmander, squirtle, bulbasaur, blastoise, mewtwo, mew,
eevee, snorlax, gengar, lugia, ho-oh, rayquaza, reshiram, zekrom, kyurem, calyrex, wobbuffet,
psyduck, greninja, garchomp, lucario, metagross, tyranitar, articuno, zapdos, moltres, hoopa,
gigantamax, dynamax, pokeball, poké ball, nintendo, game freak, the pokemon company, digimon, yokai
```

Extend the list whenever you notice another franchise name. The test also fails if any file under
`packages/` has a binary image, audio or font file, to enforce that all art and audio are procedural —
except sprite files under `packages/client/public/art/` (owner decision 2026-10-17).