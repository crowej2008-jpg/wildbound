# Sky Pillar (M13.2)

Explore mode opened by clearing campaign 7-1. The source is a 180-floor, 10-stage
tower with two extra star conditions per stage, 10/20/30-star floor chests,
Proofs of Sky that recharge every eight hours, and sweeps of the best 3-star
record. Counts and shapes follow the source; names, numbers, conditions and
rewards are original.

## Content (`packages/content/tuning/sky-pillar.json`)

- **180 floors x 10 stages** (1,800 stages), split into six 30-floor wings:
  Ashen Steps, Tidal Rise, Verdant Span, Stormward Reach, Rime Gallery, Umbra
  Crown. The generator (`scripts/generate-sky-pillar.mjs`) is one-time; the
  runtime reads the JSON.
- Each floor gates on the **previous floor being fully cleared** and a **player
  level** that rises from 1 to 80 (the roster's level cap). Floors 1-20 stay low;
  the last floors ask for 80.
- Each floor reuses one faction pool with a six-Wild enemy squad. Enemy level
  grows by floor (`levelSlope`), and stars/evolution stage step up every 8/16
  floors.
- Every stage pays **Potential Shards** on a first clear and half that on a
  sweep. The per-floor values rise smoothly; later floors pay more.
- **Star conditions:** the clear itself is the first star; every stage adds two
  of `knockoutsAtMost`, `hpAtLeast` (percent) and `roundsAtMost`. Early floors
  are forgiving; later floors cap knockouts at 1-2 and rounds at 3-4, matching
  the source's shape.
- **Floor chests** at 10, 20 and 30 stars. 10 and 20 pay gems; 30 pays Premium
  Tickets on floors 1-8 and Star Shards from floor 9, mirroring the source's
  switch from summon currency to shards.

## Rules (`packages/engine/src/sky-pillar`)

- **Proofs of Sky:** start at 6, recharge one every 480 minutes while below 6,
  and stop the clock at the cap. The purse may exceed 6 (the source's cap only
  stops the refill); spending from above the cap restarts the timer at the spend
  moment.
- **Challenges cost one proof**, win or lose, except a stage that already has a
  star record: re-challenging a passed stage is free so the player can improve
  its rating.
- A battle has a **15 big-round counter**; a time-out is a loss. This is the
  source's visible 15-turn counter, passed as the `roundLimit` battle rule.
- **Stars:** a win is always 1; each satisfied condition adds one. The best
  score per stage is kept. `floorStarTotal` sums the ten best records.
- **Sweeps** cost one proof and pay the sweep reward of the **highest stage that
  has a 3-star record**. With no 3-star record there is nothing to sweep.
- **Floor chests** are claimable once the floor's star total reaches 10/20/30
  and are then permanently claimed.

## Server and save

- `getSkyPillar(floor?)` lazily rolls proofs, returns all 180 floor summaries
  and the selected floor's stage cards. It commits the rolled proofs.
- `challengeSkyPillar(floor, stage, seed?)` validates the previous-floor and
  player-level gates, spends a proof when needed, fights with the `skyPillar`
  squad and records the best stars. A battle result carries the graded stars,
  the rewards and the floor's chest state.
- `sweepSkyPillar()` pays the top 3-star sweep and spends a proof.
- `claimSkyPillarChest(floor, stars)` grants a reached chest once.
- Save **v17** adds `skyPillar: { stars, proofs, lastProofAt, claimedChests }`.
  Migration fills missing slices and adds the new `skyPillar` squad mode and
  strategy default.

## Client

`/explore/sky-pillar` shows the proof purse and countdown, the six wings, a
floor picker, the selected floor's ten stages with conditions and best stars,
chest claim buttons, Challenge and Sweep. Locked floors explain the previous
floor and player-level requirements. The Explore card is `live`.

## Assumptions

- Player-level gates are capped at 80 because trainer level is capped at 80 in
  this build; the source goes to 200.
- The source's 15-turn counter is implemented as a loss on time-out. The
  `roundLimit` battle rule is only used by Sky Pillar.
- HP star conditions count only surviving attackers (a dead Wild is already
  covered by the knockout condition).
- Sweeps use the highest 3-star stage across all floors, not a per-floor choice.
- Badge/skin bonuses to Potential Shards are not part of M13.2; they belong to
  the later badge/privilege pass if added.
