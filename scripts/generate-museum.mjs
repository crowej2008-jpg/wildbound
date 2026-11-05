/* eslint-disable no-undef */
/**
 * Writes the museum part of packages/content/tuning/dig-site.json (owner, 2026-11-04): fossils and treasures from
 * the Dig Site, plus every berry, held item, orb (kind × colour) and soul heart (set × socket). The player chooses
 * what to donate and the donated copy is used up. Each piece gives flat HP / ATK; each full group gives flat HP /
 * ATK, % HP / ATK and two rarer lines. Ranks 1–5 set the numbers; every number is a stand-in.
 *
 *   node scripts/generate-museum.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const tuningPath = 'packages/content/tuning/dig-site.json';
const tuning = read(tuningPath);
const berries = read('packages/content/equipment/berries.json').berries;
const held = read('packages/content/equipment/held-items.json').items;
const orbs = read('packages/content/equipment/orbs.json');
const cores = read('packages/content/equipment/cores.json').sets;

const RANK = {
  hp: [0, 20000, 50000, 100000, 160000, 240000],
  atk: [0, 1700, 4200, 8300, 13300, 20000],
  pct: [0, 0.02, 0.03, 0.04, 0.06, 0.08],
  rare: [0, 0.01, 0.015, 0.02, 0.03, 0.04],
};
const PIECE = { fossil: [3000, 250], treasure: [1500, 125], berry: [500, 40], heldItem: [800, 65], orb: [400, 35], soulHeart: [600, 50] };
const RARE = ['crit', 'critRes', 'critPower', 'block', 'blockPower', 'guardBreak', 'dmgBoost', 'dmgRdct', 'controlBoost', 'controlRes', 'pvpBoost', 'pvpRdct'];
let rareAt = 0;
const nextPair = () => {
  const a = RARE[rareAt % RARE.length];
  const b = RARE[(rareAt + 5) % RARE.length];
  rareAt += 1;
  return [a, b];
};

const groups = [];
const pieces = [];
function group(id, name, category, rank, fixed) {
  const [a, b] = fixed ?? nextPair();
  groups.push({
    id,
    name,
    category,
    hp: RANK.hp[rank],
    atk: RANK.atk[rank],
    hpPct: RANK.pct[rank],
    atkPct: RANK.pct[rank],
    lines: [
      { field: a, value: RANK.rare[rank] },
      { field: b, value: RANK.rare[rank] },
    ],
  });
}
function piece(id, name, groupId, kind, match, scale = 1) {
  const [hp, atk] = PIECE[kind];
  pieces.push({ id, name, group: groupId, kind, hp: Math.round(hp * scale), atk: Math.round(atk * scale), ...(match ? { match } : {}) });
}

// Dig finds: the existing fossil / treasure pieces keep their groups.
const FIND_GROUPS = [
  ['shells', 'Ancient Shells', 2, ['block', 'critRes']],
  ['roots', 'Roots and Claws', 2, ['guardBreak', 'crit']],
  ['heads', 'Heads and Armor', 2, ['dmgRdct', 'controlRes']],
  ['ancient', 'Ancient Seas and Skies', 3, ['dmgBoost', 'critPower']],
  ['amber', 'Amber', 3, ['critPower', 'pvpBoost']],
  ['stones', 'Evolution Stones', 2, ['controlBoost', 'blockPower']],
  ['shards', 'Coloured Shards', 2, ['critRes', 'pvpRdct']],
  ['jewels', 'Jewels', 3, ['crit', 'dmgBoost']],
];
for (const [id, name, rank, pair] of FIND_GROUPS) group(id, name, 'finds', rank, pair);
const findName = new Map(tuning.items.map((i) => [i.id, i.name]));
for (const p of tuning.pieces.filter((x) => x.kind === undefined || x.kind === 'fossil' || x.kind === 'treasure')) {
  const kind = p.id.startsWith('fossil-') ? 'fossil' : 'treasure';
  piece(p.id, findName.get(p.id) ?? p.id, p.group, kind, null, p.id === 'fossil-old-amber' ? 2 : 1);
}

// Berries by tier.
const BERRY_TIERS = [['common', 'Common Berries', 1], ['basic', 'Basic Berries', 2], ['intermediate', 'Intermediate Berries', 3], ['greater', 'Greater Berries', 5]];
for (const [tier, name, rank] of BERRY_TIERS) {
  group(`berries-${tier}`, name, 'berries', rank);
  for (const b of berries.filter((x) => x.tier === tier)) piece(`berry-${b.id}`, b.name, `berries-${tier}`, 'berry', { defId: b.id }, rank);
}

// Held items by tier.
const HELD_TIERS = [['rare', 'Rare Held Items', 1], ['epic', 'Epic Held Items', 2], ['legendary', 'Legendary Held Items', 3], ['supreme', 'Supreme Held Items', 4], ['mythic', 'Mythic Held Items', 5]];
for (const [tier, name, rank] of HELD_TIERS) {
  group(`held-${tier}`, name, 'heldItems', rank);
  for (const h of held.filter((x) => x.tier === tier)) piece(`held-${h.id}`, h.name, `held-${tier}`, 'heldItem', { defId: h.id }, rank);
}

// Orbs: every kind in each colour; a colour is a group.
const COLOUR_NAME = { green: 'Green', blue: 'Blue', purple: 'Purple', orange: 'Orange', red: 'Red' };
orbs.colours.forEach((c, i) => {
  const rank = i + 1;
  group(`orbs-${c.id}`, `${COLOUR_NAME[c.id] ?? c.id} Orbs`, 'orbs', rank);
  for (const k of orbs.kinds) piece(`orb-${k.id}-${c.id}`, `${COLOUR_NAME[c.id] ?? c.id} ${k.name}`, `orbs-${c.id}`, 'orb', { orbKind: k.id, colour: c.id }, rank);
});

// Soul hearts: each set is a group of its six sockets.
for (const s of cores) {
  group(`souls-${s.id}`, `${s.name} Soul Hearts`, 'soulHearts', 2);
  for (let socket = 0; socket < 6; socket += 1) {
    piece(`soul-${s.id}-${socket + 1}`, `${s.name} Soul Heart ${['I', 'II', 'III', 'IV', 'V', 'VI'][socket]}`, `souls-${s.id}`, 'soulHeart', { setId: s.id, socket });
  }
}

tuning.groups = groups;
tuning.pieces = pieces;
writeFileSync(join(root, tuningPath), `${JSON.stringify(tuning, null, 1)}\n`);
const pct = groups.reduce((s, g) => s + g.hpPct, 0);
console.log(`museum: ${pieces.length} pieces in ${groups.length} groups; all groups: +${Math.round(pct * 100)}% HP / ATK`);
