/* eslint-disable no-undef */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One-time generator for the M13.2 Sky Pillar table. The source's visible
 * shapes are preserved (180 floors x 10 stages, six wings, 10/20/30-star
 * chests, 8-hour proofs, two extra star conditions); every number, reward and
 * name is original. The runtime never generates content. Run from the repo
 * root:
 *
 *   node scripts/generate-sky-pillar.mjs
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'packages/content/tuning/sky-pillar.json');

const factions = ['ember', 'tide', 'grove', 'volt', 'frost', 'shade'];
const wings = [
  { wing: 1, name: 'Ashen Steps' },
  { wing: 2, name: 'Tidal Rise' },
  { wing: 3, name: 'Verdant Span' },
  { wing: 4, name: 'Stormward Reach' },
  { wing: 5, name: 'Rime Gallery' },
  { wing: 6, name: 'Umbra Crown' },
];

function playerLevelFor(floor) {
  if (floor <= 10) return 1;
  if (floor <= 20) return 5 + Math.floor((floor - 11) / 2);
  if (floor <= 40) return 10 + Math.floor((floor - 21) / 2);
  if (floor <= 80) return 20 + Math.floor((floor - 41) / 2);
  if (floor <= 140) return 40 + Math.floor((floor - 81) / 2);
  return Math.min(80, 70 + Math.floor((floor - 141) / 2));
}

function passReward(floor) {
  const potentialShard = floor <= 41 ? 120 + 40 * floor : 1600 + 10 * floor;
  return { potentialShard };
}

function sweepReward(floor) {
  return { potentialShard: Math.floor((floor <= 41 ? 120 + 40 * floor : 1600 + 10 * floor) / 2) };
}

function conditionsFor(floor, stage) {
  const early = floor <= 18;
  const knockouts = early ? 4 - (stage % 3) : 2 - (stage % 2);
  const second =
    stage % 2 === 1
      ? { kind: 'hpAtLeast', value: early ? 40 : 30 }
      : { kind: 'roundsAtMost', value: early ? 6 - (stage % 3) : 4 - (stage % 2) };
  return [{ kind: 'knockoutsAtMost', value: knockouts }, second];
}

function chestRewards(floor, stars) {
  if (stars < 30) return { gems: 20 };
  if (floor <= 2) return { ticketPremium: 2 };
  if (floor <= 8) return { ticketPremium: 1 };
  return { starShard: 50 };
}

const floors = Array.from({ length: 180 }, (_, index) => {
  const floor = index + 1;
  const wing = Math.floor((floor - 1) / 30) + 1;
  return {
    floor,
    wing,
    playerLevel: playerLevelFor(floor),
    enemy: {
      factions: [factions[wing - 1]],
      tiers: [],
      count: 6,
      baseLevel: 3,
      levelSlope: 1.018,
      starsEvery: 8,
      maxStars: 10,
      stageEvery: 16,
      maxStage: 3,
    },
    stages: Array.from({ length: 10 }, (_, stageIndex) => {
      const stage = stageIndex + 1;
      return {
        stage,
        pass: passReward(floor),
        sweep: sweepReward(floor),
        conditions: conditionsFor(floor, stage),
      };
    }),
    chests: [10, 20, 30].map((stars) => ({ stars, rewards: chestRewards(floor, stars) })),
  };
});

const data = {
  maxProofs: 6,
  regenMinutes: 480,
  initialProofs: 6,
  roundLimit: 15,
  wings,
  floors,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
console.log(`wrote ${out}`);
