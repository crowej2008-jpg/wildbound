/* eslint-disable no-undef */
/**
 * M13.6: write packages/content/tuning/misty.json (Misty Woods) from the source's maze tables (modes2_cfg
 * 2026-10-02): the 96-node graph (`maze_node_json`), each floor's enemy rate and first-win pay
 * (`maze_reward_json`: Forest Coins, + 10 Diamonds on floor 11) and the chapter-4 gate (`maze_basic_json`
 * lv4_condition 102010 = story 20-10). Runes (`maze_rune_json`) are cut (owner 2026-11-04).
 * Readings / stand-ins (docs/design/misty-woods.md): the tile ids 1–7, the fountain / revive / shop numbers, the
 * enemy curve; `reward_rate` (Gold / XP Candy figures) is not copied.
 *
 *   node scripts/import-misty.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const modes = JSON.parse(readFileSync(join(sourceRoot, '2026-10-02', 'modes2_cfg.json'), 'utf8'));
const TILE = { 1: 'fight', 2: 'boss', 3: 'start', 4: 'tombstone', 5: 'fountain', 6: 'hire', 7: 'shop' };

const nodes = Object.values(modes.maze_node_json)
  .sort((a, b) => a.id - b.id)
  .map((n) => ({ id: n.id, chapter: n.chapter_id, floor: n.floor_id, pos: n.pos, tiles: n.type_list.map((t) => TILE[t]), pre: n.pre_list }));

const floors = [];
for (const [chapter, rows] of Object.entries(modes.maze_reward_json)) {
  for (const r of Object.values(rows)) {
    const coin = r.reward.find(([id]) => id === 28)?.[1] ?? 0;
    const gems = r.reward.find(([id]) => id === 2)?.[1] ?? 0;
    floors.push({ chapter: Number(chapter), floor: r.floor, rate: r.rate, forestCoin: coin, gems });
  }
}
floors.sort((a, b) => a.chapter - b.chapter || a.floor - b.floor);

const lv4 = String(modes.maze_basic_json.lv4_condition); // 10CCSS
const chapter4Stage = `c${Number(lv4.slice(2, 4))}-${Number(lv4.slice(4, 6))}`;

const tuning = {
  cycleDays: 2,
  chapter4Stage,
  nodes,
  floors,
  fountainHeal: 0.3,
  reviveHp: 0.5,
  shop: { healAll: 50, revive: 100 },
  hireOffers: 3,
  enemy: { factions: [], tiers: [], count: 6, baseLevel: 1, levelSlope: 1, starsEvery: 0, maxStars: 20, stageEvery: 0, maxStage: 3 },
};
writeFileSync(join(repoRoot, 'packages/content/tuning/misty.json'), `${JSON.stringify(tuning, null, 2)}\n`);
console.log(`misty.json: ${nodes.length} nodes, ${floors.length} floors, chapter 4 needs ${chapter4Stage}`);
