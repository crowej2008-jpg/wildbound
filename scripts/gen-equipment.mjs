/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'packages/content/equipment');
mkdirSync(outDir, { recursive: true });

const pct = (field, base, perLevel = 0) => ({ kind: 'percent', field, base, perLevel });
const core = (field, base, perLevel = 0) => ({ kind: 'core', field, base, perLevel });
const soul = (field, base, perLevel = 0) => ({ kind: 'soul', field, base, perLevel });
const fx = (tag, text, field, add, fromRound, bigRounds) => {
  const e = { tag, text, field, fromRound };
  if (add !== undefined) e.add = add;
  if (bigRounds !== undefined) e.bigRounds = bigRounds;
  return e;
};
const fxMult = (tag, text, field, mult, fromRound) => ({ tag, text, field, mult, fromRound });

const TIERS = ['common', 'common', 'rare', 'rare', 'epic', 'epic', 'legendary', 'legendary', 'supreme'];
const CLASSES = ['striker', 'guardian', 'adept'];

// --- Relics: 27 designs, 9 per class, across five quality levels -------------
const relicNames = {
  striker: ['Ashpike Sigil', 'Razorwing Totem', 'Bloodmoon Fang', 'Thunderstep Brand', 'Duelist Emblem', 'Ravager Core', 'Windcleaver Idol', 'Cinderclaw Relic', 'Titanspur'],
  guardian: ['Bulwark Sigil', 'Ironshell Totem', 'Bastion Heart', 'Stonewarden Brand', 'Aegis Emblem', 'Mountainhold Core', 'Tidewall Idol', 'Quakestep Relic', 'Bastion Spur'],
  adept: ['Runeweaver Sigil', 'Starcall Totem', 'Veilbrand Heart', 'Miststep Brand', 'Oracle Emblem', 'Dreamroot Core', 'Snowveil Idol', 'Spiritgale Relic', 'Lumenspur'],
};
const relicSlug = (name) => 'relic-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function relicLines(className, t) {
  if (className === 'striker') {
    return [core('pAtk', 40 + t * 18, 14 + t * 5), pct('crit', 0.02 + (t % 3) * 0.01, 0.004)];
  }
  if (className === 'guardian') {
    return [core('hp', 220 + t * 130, 90 + t * 20), pct('dmgRdct', 0.02 + (t % 3) * 0.01, 0.003)];
  }
  return [core('sAtk', 34 + t * 16, 12 + t * 5), pct('skillBoost', 0.02 + (t % 3) * 0.012, 0.004)];
}

const relicEffects = {
  striker: (t) => [
    fx('relic-open', 'Deals more damage after round 1', 'dmgBoost', 0.1 + t * 0.02, 1),
    fx('relic-mid', 'Gains damage at round 3', 'dmgBoost', 0.12 + t * 0.02, 3),
    fx('relic-late', 'Gains damage at round 5', 'dmgBoost', 0.16 + t * 0.02, 5),
    fx('relic-guard', 'Takes less damage in round 1', 'dmgRdct', 0.15 + t * 0.02, 1, 1),
    fxMult('relic-atk', 'Stronger basic attacks from round 3', 'pAtk', 1.1 + t * 0.02, 3),
    fx('relic-crit', 'Crit power rises with the fight', 'critPower', 0.1 + t * 0.03, 3),
  ][t % 6],
  guardian: (t) => [
    fx('relic-guard', 'Takes less damage from round 1', 'dmgRdct', 0.04 + t * 0.015, 1),
    fx('relic-open', 'Braces in round 1', 'dmgRdct', 0.15 + t * 0.02, 1, 1),
    fx('relic-mid', 'Gains damage at round 3', 'dmgBoost', 0.08 + t * 0.02, 3),
    fxMult('relic-hp', 'Hardier after round 2', 'hp', 1.08 + t * 0.02, 2),
    fx('relic-critres', 'Resists crits as the fight goes on', 'critRes', 0.08 + t * 0.03, 3),
  ][t % 5],
  adept: (t) => [
    fx('relic-open', 'Skills hit harder after round 1', 'skillBoost', 0.06 + t * 0.02, 1),
    fx('relic-mid', 'Gains skill power at round 3', 'skillBoost', 0.1 + t * 0.02, 3),
    fx('relic-heal', 'Healing improves mid-fight', 'healBoost', 0.08 + t * 0.02, 2),
    fx('relic-crit', 'Crit power rises from round 3', 'critPower', 0.1 + t * 0.03, 3),
    fxMult('relic-satk', 'Stronger skills from round 3', 'sAtk', 1.1 + t * 0.02, 3),
  ][t % 5],
};

const relics = [];
for (const className of CLASSES) {
  relicNames[className].forEach((name, i) => {
    relics.push({
      id: relicSlug(name),
      name,
      className,
      tier: TIERS[i],
      lines: relicLines(className, i),
      effect: relicEffects[className](i),
    });
  });
}

// --- Runes: 4 colour sets x 3 runes, levels 1-6 -----------------------------
const runeSets = [
  { id: 'runeset-verdant', name: 'Verdant Loop', tier: 'common', colour: 'verdent-green', bonus: pct('healBoost', 0.1) },
  { id: 'runeset-azure', name: 'Azure Pact', tier: 'rare', colour: 'azure-blue', bonus: pct('dmgBoost', 0.08) },
  { id: 'runeset-amber', name: 'Amber Coil', tier: 'epic', colour: 'amber-gold', bonus: pct('critPower', 0.15) },
  { id: 'runeset-crimson', name: 'Crimson Crown', tier: 'legendary', colour: 'crimson-red', bonus: pct('guardBreak', 0.1) },
];
const runeKinds = [
  { suffix: 'Spark', line: (t) => pct('dmgBoost', 0.03 + t * 0.015, 0.006) },
  { suffix: 'Glint', line: (t) => pct('crit', 0.02 + t * 0.01, 0.005) },
  { suffix: 'Ward', line: (t) => [pct('dmgRdct', 0.02 + t * 0.01, 0.004), soul('spiritDef', 6 + t * 4, 3)] },
];
const runes = [];
runeSets.forEach((set, t) => {
  const word = set.name.split(' ')[0];
  runeKinds.forEach((kind) => {
    const raw = kind.line(t);
    runes.push({ id: `rune-${word.toLowerCase()}-${kind.suffix.toLowerCase()}`, name: `${word} ${kind.suffix}`, setId: set.id, tier: set.tier, lines: Array.isArray(raw) ? raw : [raw] });
  });
});

// --- Charms: four tiers x four, higher tiers scale with stars ---------------
const charms = [
  { name: 'Sunpetal Berry', tier: 'common', maxStars: 0, lines: [core('hp', 300)] },
  { name: 'Mistbud Berry', tier: 'common', maxStars: 0, lines: [core('pAtk', 30)] },
  { name: 'Ironpeel Berry', tier: 'common', maxStars: 0, lines: [core('sAtk', 30)] },
  { name: 'Glimmerberry', tier: 'common', maxStars: 0, lines: [pct('dmgBoost', 0.05)] },
  { name: 'Emberfruit', tier: 'basic', maxStars: 2, lines: [core('hp', 400, 250)] },
  { name: 'Tidefruit', tier: 'basic', maxStars: 2, lines: [core('pAtk', 40, 25)] },
  { name: 'Grovefruit', tier: 'basic', maxStars: 2, lines: [core('sAtk', 40, 25)] },
  { name: 'Voltfruit', tier: 'basic', maxStars: 2, lines: [pct('dmgBoost', 0.04, 0.02)] },
  { name: 'Frostplum', tier: 'intermediate', maxStars: 3, lines: [core('hp', 700, 300)] },
  { name: 'Shadeplum', tier: 'intermediate', maxStars: 3, lines: [core('pAtk', 70, 30)] },
  { name: 'Amberplum', tier: 'intermediate', maxStars: 3, lines: [core('sAtk', 70, 30)] },
  { name: 'Umbraplum', tier: 'intermediate', maxStars: 3, lines: [pct('dmgBoost', 0.06, 0.02)] },
  { name: 'Dawnspire Fruit', tier: 'greater', maxStars: 5, lines: [core('hp', 1100, 350), pct('receiveHealBoost', 0.05, 0.02)] },
  { name: 'Duskbloom Fruit', tier: 'greater', maxStars: 5, lines: [core('pAtk', 100, 35), pct('dmgBoost', 0.04, 0.015)] },
  { name: 'Stormcore Fruit', tier: 'greater', maxStars: 5, lines: [core('sAtk', 100, 35), pct('skillBoost', 0.04, 0.015)] },
  { name: 'Wyrdstar Fruit', tier: 'greater', maxStars: 5, lines: [pct('crit', 0.03, 0.01), pct('critPower', 0.1, 0.03)] },
].map((c) => ({ id: 'charm-' + c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), ...c }));

// --- Spirit cores: 12 sets x 6 sockets, 2-5 stars ---------------------------
const coreSetNames = [
  'Pyre Heart', 'Riptide Heart', 'Bloom Heart', 'Stormheart', 'Rimeheart', 'Umbra Heart',
  'Dawnheart', 'Duskheart', 'Wyrmheart', 'Leviathan Heart', 'Golem Heart', 'Wyrdheart',
];
const focusLine = (i) => {
  if (i % 3 === 0) return pct('dmgBoost', 0.05 + (i % 12) * 0.005);
  if (i % 3 === 1) return pct('dmgRdct', 0.04 + (i % 12) * 0.004);
  return pct('critPower', 0.08 + (i % 12) * 0.01);
};
const coreSets = coreSetNames.map((name, i) => {
  const atk = 14 + i * 2;
  const def = 12 + i * 2;
  return {
    id: 'coreset-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    socketLines: [
      [soul('spiritAtk', atk, 9)],
      [soul('spiritDef', def, 8)],
      [soul('spiritAtk', atk + 4, 10)],
      [soul('spiritDef', def + 4, 9)],
      [soul('spiritAtk', atk + 2, 9)],
      [soul('spiritDef', def + 2, 8)],
    ],
    bonuses: [
      { pieces: 2, lines: [focusLine(i)] },
      { pieces: 4, lines: [pct('dmgRdct', 0.05 + (i % 6) * 0.005), core('hp', 150 + i * 20)] },
      {
        pieces: 6,
        lines: [],
        effect:
          i % 4 === 0
            ? fx('core-open', 'Deals more damage from the first round', 'dmgBoost', 0.1 + (i % 6) * 0.01, 1)
            : i % 4 === 1
              ? fxMult('core-atk', 'Stronger attacks from round 3', 'pAtk', 1.12 + (i % 6) * 0.01, 3)
              : i % 4 === 2
                ? fx('core-brace', 'Braces hard in round 1', 'dmgRdct', 0.2, 1, 1)
                : fx('core-scale', 'Gains damage reduction as the fight goes on', 'dmgRdct', 0.06 + (i % 6) * 0.01, 3),
      },
    ],
  };
});

// --- Talents: 15 shared trees assembled from reusable blocks ----------------
const write = (file, data) => writeFileSync(join(outDir, file), JSON.stringify(data, null, 2) + '\n');
writeFileSync(join(outDir, 'relics.json'), JSON.stringify({ relics }, null, 2) + '\n');
writeFileSync(join(outDir, 'runes.json'), JSON.stringify({ runes, sets: runeSets.map(({ id, name, tier, bonus }) => ({ id, name, pieces: 3, lines: [bonus] })) }, null, 2) + '\n');
writeFileSync(join(outDir, 'charms.json'), JSON.stringify({ charms }, null, 2) + '\n');
writeFileSync(join(outDir, 'cores.json'), JSON.stringify({ sets: coreSets }, null, 2) + '\n');
// R4: talents.json (the M7 stand-in Potential) is gone — scripts/import-potential.mjs writes the source's.

// --- tuning -----------------------------------------------------------------
const tuning = {
  relic: { minTier: 'supreme', maxLevel: 5, maxRefine: 5 },
  runes: { minStars: 3, sockets: 4, maxLevel: 6 },
  charms: { minStars: 4, slots: 1 },
  cores: { minStars: 10, sockets: 6, pieceMinStars: 2, pieceMaxStars: 5 },
  relicLevelCost: { gold: 400, candy: 60, goldPerLevel: 300, candyPerLevel: 40 },
  relicRefineCost: { gold: 800, stone: 1, goldPerRefine: 400, stonePerRefine: 1 },
  runeLevelCost: { gold: 300, goldPerLevel: 200 },
  starting: {
    relics: [
      { defId: relicSlug(relicNames.striker[0]), level: 1, refine: 0 },
      { defId: relicSlug(relicNames.guardian[0]), level: 1, refine: 0 },
      { defId: relicSlug(relicNames.adept[0]), level: 1, refine: 0 },
    ],
    runes: runes.slice(0, 6).map((r) => ({ defId: r.id, level: 1 })),
    cores: [],
    charms: charms.slice(0, 8).map((c) => ({ defId: c.id, stars: Math.max(1, c.maxStars), count: 3 })),
  },
};
writeFileSync(join(root, 'packages/content/tuning/equipment.json'), JSON.stringify(tuning, null, 2) + '\n');
console.log('wrote', relics.length, 'relics,', runes.length, 'runes,', charms.length, 'charms,', coreSets.length, 'core sets');
