#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R6a: import the source's plates into packages/content/equipment/plates.json.
 *
 * Source tables (pokemon_data_cfg): stone_basic_json (54 plates = 18 types × 3 grades; the English names
 * from `_text`), stone_up_stage_json (stats per stage 0–18 — identical for every plate),
 * hero_evolution_json (each card's race_type = its plate). Not in the dumps' stage rows (item_cost is
 * null there), copied from kb/plate.md: the step prices (Bottles / Fragments), the Pokémon-level gates
 * from stage 6 (Lv 47) and 12 (Lv 60), and the unlock (player Lv 34, Pokémon 6★).
 * The plate skills (tiers 6 / 12 / 18, hero_stone_skill_json) come in R6a part 2.
 *
 *   WILDBOUND_SOURCE=…/h5-client node scripts/import-plates.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTextMap, repoRoot, tableRows } from './source/source.mjs';

const text = loadTextMap();
const rows = (name) => {
  const r = tableRows(name);
  return Array.isArray(r) ? r : Object.values(r);
};

// Plates: id → English name.
const plates = rows('stone_basic_json')
  .map((r) => ({ id: r.stone_id, name: text[r.stone_name] ?? r.stone_name }))
  .sort((a, b) => a.id - b.id);

// Stats per stage (every plate the same: checked).
const ATTR = { 301: 'hp', 302: 'pAtk', 304: 'sAtk', 106: 'hpPct' };
const perStone = rows('stone_up_stage_json').map((stone) =>
  Object.values(stone)
    .sort((a, b) => a.stone_stage - b.stone_stage)
    .map((r) => {
      const s = { stage: r.stone_stage, hp: 0, pAtk: 0, sAtk: 0, hpPct: 0 };
      for (const [id, v] of r.stone_attr) s[ATTR[id]] = id === 106 ? v / 10000 : v;
      return s;
    }),
);
const stages = perStone[0];
for (const other of perStone) if (JSON.stringify(other) !== JSON.stringify(stages)) throw new Error('plates differ');

// Step prices from stage N to N + 1 (kb/plate.md), and the Pokémon level each step needs.
const B = (amount, level = 0) => ({ currency: 'plateBottle', amount, level });
const F = (amount, level = 0) => ({ currency: 'plateFragment', amount, level });
const steps = [
  B(15), B(15), B(20), B(20), B(20), F(375),
  B(30, 47), B(30, 47), B(40, 47), B(40, 47), B(40, 47), F(750, 47),
  B(60, 60), B(60, 60), B(80, 60), B(80, 60), B(80, 60), F(1500, 60),
];
const total = steps.reduce((a, s) => ({ ...a, [s.currency]: (a[s.currency] ?? 0) + s.amount }), {});
if (total.plateBottle !== 630 || total.plateFragment !== 2625) throw new Error(`step totals ${JSON.stringify(total)}`);

// Each species' plate by star (the card's race_type).
const speciesDir = join(repoRoot, 'packages/content/species');
const bySource = new Map();
for (const file of ['water', 'fire', 'grass', 'light', 'dark']) {
  const list = JSON.parse(readFileSync(join(speciesDir, `${file}.json`), 'utf8'));
  for (const s of Array.isArray(list) ? list : list.species) bySource.set(s.sourceId, s.id);
}
const species = {};
for (const row of rows('hero_evolution_json')) {
  const cards = row.hero_id ? [row] : Object.values(row);
  for (const c of cards) {
    const id = bySource.get(c.hero_id);
    if (!id || !plates.some((p) => p.id === c.race_type)) continue;
    (species[id] ??= {})[c.qua_star] = c.race_type;
  }
}

const out = {
  unlock: { playerLevel: 34, stars: 6 },
  plates,
  stages,
  steps,
  // Starmie and Ninetales swap their skills at stage 6 (hero_slate_skill_json); the rest gain plate skills.
  skillSwapStage: 6,
  // Per species, [from star, plate] runs (a plate can change with the card).
  species: Object.fromEntries(
    Object.entries(species)
      .sort()
      .map(([id, byStar]) => {
        const runs = [];
        for (const [star, plate] of Object.entries(byStar).sort((a, b) => Number(a[0]) - Number(b[0]))) {
          if (runs.length === 0 || runs[runs.length - 1][1] !== plate) runs.push([Number(star), plate]);
        }
        return [id, runs];
      }),
  ),
};
writeFileSync(join(repoRoot, 'packages/content/equipment/plates.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`plates: ${plates.length} plates, ${stages.length} stages, ${Object.keys(species).length} species`);
