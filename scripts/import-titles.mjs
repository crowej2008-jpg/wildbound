#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R8: import the source's 102 titles into packages/content/titles/titles.json.
 *
 * Source (boosts_cfg): title_basic_json (layer = slot 1 Common / 2 Premium / 3 Rare, day = 7 / 14-day timer,
 * type 1 = auto-granted by trainer level) and title_up_stage_json (per stage: the stats it gives and the cost row;
 * the current stage's row is paid to go up, the top row to continue a timed title). Every cost is the title's own
 * activation card (one item per title). English names and how-to-earn text come from the dump's `_titles` notes.
 * Stats: 101 / 102 / 104 flat HP / P.ATK / S.ATK; 106 / 107 / 109 Total HP / P.ATK / S.ATK in hundredths of a %.
 * Wildbound sources (`earnedBy`): Starter Trainer is owned from the start; Beginner → Master Trainer come from the
 * Tower floors the source pays them at (dun_tower_json achieve_reward). The rest wait for their modes.
 *
 *   WILDBOUND_SOURCE=…/h5-client node scripts/import-titles.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dumpFiles, loadTable, repoRoot } from './source/source.mjs';

const basic = loadTable('title_basic_json');
const stages = loadTable('title_up_stage_json');
const notes = dumpFiles()
  .map((f) => JSON.parse(readFileSync(f, 'utf8'))._titles)
  .filter(Boolean)
  .pop();
if (!notes) throw new Error('no _titles notes in the dumps');
const english = new Map(notes.titles.map((t) => [t.id, t]));

const SLOT = { 1: 'common', 2: 'premium', 3: 'rare' };
const STAT = {
  101: ['core', 'hp', 1],
  102: ['core', 'pAtk', 1],
  104: ['core', 'sAtk', 1],
  106: ['percent', 'hpPct', 10000],
  107: ['percent', 'pAtkPct', 10000],
  109: ['percent', 'sAtkPct', 10000],
};
const statLines = (attr) =>
  (attr ?? []).map(([id, raw]) => {
    const s = STAT[id];
    if (!s) throw new Error(`unknown title attr ${id}`);
    return { kind: s[0], field: s[1], base: raw / s[2], perLevel: 0 };
  });

// dun_tower_json achieve_reward: the floors that pay a title card.
const towerCards = new Map();
for (const [floorId, row] of Object.entries(loadTable('dun_tower_json'))) {
  for (const [item] of row.achieve_reward ?? []) towerCards.set(item, Number(floorId) % 10000);
}

const titles = Object.values(basic)
  .sort((a, b) => a.id - b.id)
  .map((b) => {
    const en = english.get(b.id);
    if (!en) throw new Error(`no English for title ${b.id}`);
    const rows = Object.values(stages[String(b.id)] ?? {}).sort((x, y) => x.stage - y.stage);
    const cardOf = (row) => row?.cost?.[0];
    const card = rows.map(cardOf).find(Boolean)?.[0] ?? null;
    const auto = b.type === 1;
    // Our stage n (1-based) = the source's stage n: its stats, reached by paying stage n − 1's cost row.
    const ladder = auto
      ? [{ cost: 0, stats: statLines(rows[0]?.attr) }]
      : rows.slice(1).map((row, i) => ({ cost: cardOf(rows[i])?.[1] ?? 0, stats: statLines(row.attr) }));
    const top = rows[rows.length - 1];
    const earn = (en.how_to_earn ?? []).filter((t) => !/^Title activation card\. Used/.test(t));
    let earnedBy = null;
    if (auto) earnedBy = { kind: 'start' };
    else if (card !== null && towerCards.has(card)) earnedBy = { kind: 'tower', floor: towerCards.get(card) };
    return {
      id: String(b.id),
      name: en.name,
      slot: SLOT[b.layer],
      order: b.priority,
      durationDays: b.day ?? null,
      card,
      continueCost: b.day ? cardOf(top)?.[1] ?? 0 : null,
      earn: earn[0] ?? null,
      earnedBy,
      stages: ladder,
    };
  });
if (titles.length !== 102) throw new Error(`${titles.length} titles`);
for (const t of titles) if (t.stages.length === 0 || t.stages.some((s) => s.stats.length === 0)) throw new Error(`title ${t.id} has an empty stage`);

const out = join(repoRoot, 'packages/content/titles/titles.json');
writeFileSync(out, JSON.stringify(titles, null, 2) + '\n');
console.log(`wrote ${titles.length} titles; tower cards at floors ${[...towerCards.values()].sort((a, b) => a - b).join(', ')}`);
