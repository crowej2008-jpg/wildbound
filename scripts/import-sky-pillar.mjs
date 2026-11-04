#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R9: copy the source's Sky Pillar rows into packages/content/tuning/sky-pillar.json.
 *
 * Source (modepages-pve): dun_sky_pillar_basic_json (6 proofs, one every 480 minutes, 1 a fight or sweep),
 * dun_sky_pillar_chapter_open_json (the player level each floor needs), dun_sky_pillar_layer_rewards_json (each
 * stage's pass and sweep pay in Potential Shards and its star conditions — 1 clear, 2 allies knocked out ≤ N, 3 every
 * Pokémon's HP ≥ N%, 4 rounds ≤ N) and dun_sky_pillar_chapter_rewards_json (each floor's 10 / 20 / 30-star chests).
 * Kept: the wing names and the enemies (the stages' monsters are not in the dumps).
 *
 *   node scripts/import-sky-pillar.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const d = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-pve_cfg.json'), 'utf8'));
const ITEM = { 2: 'gems', 10006: 'ticketPremium', 10056: 'potentialShard', 10103: 'pokemonShard5' };
const rewards = (list) =>
  Object.fromEntries(
    list.map(([id, n]) => {
      if (!ITEM[id]) throw new Error(`unknown Sky Pillar item ${id}`);
      return [ITEM[id], n];
    }),
  );
const COND = { 2: 'knockoutsAtMost', 3: 'hpAtLeast', 4: 'roundsAtMost' };

const basic = d.dun_sky_pillar_basic_json;
const file = join(repoRoot, 'packages/content/tuning/sky-pillar.json');
const sky = JSON.parse(readFileSync(file, 'utf8'));
sky.maxProofs = basic.max_power;
sky.initialProofs = basic.max_power;
sky.regenMinutes = basic.time;
sky.floors = sky.floors.map((floor) => {
  const f = String(floor.floor);
  const open = Object.values(d.dun_sky_pillar_chapter_open_json[f])[0];
  const layers = d.dun_sky_pillar_layer_rewards_json[f];
  const chests = Object.values(d.dun_sky_pillar_chapter_rewards_json[f]).sort((a, b) => a.index - b.index);
  return {
    ...floor,
    playerLevel: open.val,
    stages: floor.stages.map((stage) => {
      const row = layers[String(stage.stage)];
      return {
        stage: stage.stage,
        pass: rewards(row.pass_reward),
        sweep: rewards(row.sweep_reward),
        conditions: row.star_conds
          .filter(([kind]) => kind !== 1)
          .map(([kind, value]) => {
            if (!COND[kind]) throw new Error(`unknown star condition ${kind}`);
            return { kind: COND[kind], value };
          }),
      };
    }),
    chests: chests.map((c) => ({ stars: c.require_star, rewards: rewards(c.star_reward) })),
  };
});
writeFileSync(file, JSON.stringify(sky, null, 2) + '\n');
console.log(`sky pillar: ${sky.floors.length} floors from the source`);
