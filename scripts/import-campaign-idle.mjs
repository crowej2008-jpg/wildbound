#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R9: copy the source's idle (AFK) income onto every story stage (packages/content/stages/*.json).
 *
 * Source (afk_cfg `_afk`, from dun_afk_json): each Main Story stage's afk_reward per minute — Gold, Character XP and
 * XP Candies (ADV is left out: Adventure missions are not built). Wildbound's stages c1-1 … c182-10 are the
 * source's 1-1 … 182-10 one to one (the source's 1-0 start has no Wildbound stage). The stages' enemies, first-clear
 * and repeat rewards stay stand-ins: the per-stage rows (dun_basic type 1, monster bags) are not in the dumps.
 *
 *   node scripts/import-campaign-idle.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const afk = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'afk_cfg.json'), 'utf8'))._afk.stages;
const rate = new Map(afk.map((s) => [`c${s.stage}`, s.afk_reward_per_minute]));
const dir = join(repoRoot, 'packages/content/stages');
let n = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const stages = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  for (const stage of stages) {
    const r = rate.get(stage.id);
    if (!r) throw new Error(`no source idle rate for ${stage.id}`);
    stage.idlePerMinute = { gold: r.Gold, candy: r['XP Candies'], xp: r['Character XP'] };
    n += 1;
  }
  writeFileSync(join(dir, file), JSON.stringify(stages, null, 2) + '\n');
}
console.log(`idle rates copied onto ${n} stages`);
