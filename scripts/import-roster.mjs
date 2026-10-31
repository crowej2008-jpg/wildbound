/* eslint-disable no-undef */

// Superseded by scripts/import-species.mjs (R1 source retrofit, 2026-10-31): species now copy the
// source's factions, classes, qualities and star ladders. Re-running this would overwrite them with
// the old generated stats, so it refuses to run.
console.error('import-roster.mjs is superseded by import-species.mjs (R1); see docs/ASSUMPTIONS.md #49');
process.exit(1);
// One-off content generator (2026-10-15 owner override).
//
// Turns the owner's wiki dump (wiki-pokemon-skills.xlsx) into the game's species
// + kits content:
//   - the "Roster" tab supplies every creature's name / rarity / attribute;
//   - the "Skills" tab supplies real kits for the 17 creatures whose skills were
//     captured (translated into the content DSL below);
//   - the remaining creatures get one of the three original class-archetype kits.
// Classes, base stats, evolution stages and palettes are generated deterministically.
//
//   node scripts/import-roster.mjs
//
// The M1 parity kits now live as golden fixtures
// (packages/cli/tests/golden/kits/parity.json), so no original Wild remains.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = resolve(root, 'packages/content');
const FILES = ['ember', 'tide', 'grove', 'volt', 'frost', 'shade'];

/** [name, rarity, attribute] — transcribed from the sheet's "Roster" tab. */
const ROSTER = [
  ['Calyrex', 'Origin', 'Light'],
  ['Necrozma', 'Origin', 'Light'],
  ['Origin Lugia', 'Origin', 'Dark'],
  ['Origin Rayquaza', 'Origin', 'Dark'],
  ['Shadow Mewtwo', 'Origin', 'Dark'],
  ['Zacian', 'Origin', 'Light'],
  ['Arceus', 'Mythic', 'Light'],
  ['Wind-God Pidgeot', 'Mythic', 'Light'],
  ['Black Kyurem', 'Mythic', 'Dark'],
  ['Kyogre', 'Mythic', 'Light'],
  ['Hoopa', 'Mythic', 'Dark'],
  ['Mewtwo', 'Mythic', 'Dark'],
  ['Mew', 'Mythic', 'Light'],
  ['Darkrai', 'Mythic', 'Dark'],
  ['Cresselia', 'Mythic', 'Light'],
  ['Jirachi', 'Mythic', 'Light'],
  ['Solgaleo', 'Mythic', 'Light'],
  ['Lunala', 'Mythic', 'Dark'],
  ['Deoxys', 'Mythic', 'Dark'],
  ['Meloetta', 'Mythic', 'Dark'],
  ['Snorlax', 'Mythic', 'Light'],
  ['Psyduck', 'Supreme', 'Water'],
  ['Shiny Venusaur', 'Supreme', 'Grass'],
  ['Shiny Blastoise', 'Supreme', 'Water'],
  ['Shiny Charizard', 'Supreme', 'Fire'],
  ['Shiny Gengar', 'Supreme', 'Fire'],
  ['Shiny Raichu', 'Supreme', 'Grass'],
  ['Shiny God Ash-Pikachu', 'Supreme', 'Grass'],
  ['God Ash-Pikachu', 'Supreme', 'Grass'],
  ['Mimikyu', 'Supreme', 'Fire'],
  ['Wobbuffet', 'Supreme', 'Grass'],
  ['Yveltal', 'Supreme', 'Fire'],
  ['Xerneas', 'Supreme', 'Water'],
  ['Giratina', 'Supreme', 'Fire'],
  ['Zygarde', 'Supreme', 'Grass'],
  ['Palkia', 'Supreme', 'Water'],
  ['Dialga', 'Supreme', 'Grass'],
  ['Keldeo', 'Supreme', 'Water'],
  ['Victini', 'Supreme', 'Fire'],
  ['Shaymin', 'Supreme', 'Grass'],
  ['Infernape', 'Supreme', 'Fire'],
  ['Greninja', 'Supreme', 'Water'],
  ['Manaphy', 'Supreme', 'Water'],
  ['Celebi', 'Supreme', 'Grass'],
  ['Ho-Oh', 'Supreme', 'Fire'],
  ['Groudon', 'Supreme', 'Fire'],
  ['Rayquaza', 'Supreme', 'Grass'],
  ['Lugia', 'Supreme', 'Water'],
  ['Entei', 'Legendary', 'Fire'],
  ['Suicune', 'Legendary', 'Water'],
  ['Raikou', 'Legendary', 'Grass'],
  ['Moltres', 'Legendary', 'Fire'],
  ['Articuno', 'Legendary', 'Water'],
  ['Zapdos', 'Legendary', 'Grass'],
  ['Gyarados', 'Epic', 'Water'],
  ['Blaziken', 'Epic', 'Fire'],
  ['Swampert', 'Epic', 'Water'],
  ['Sceptile', 'Epic', 'Grass'],
  ['Typhlosion', 'Epic', 'Fire'],
  ['Feraligatr', 'Epic', 'Water'],
  ['Meganium', 'Epic', 'Grass'],
  ['Dragonite', 'Epic', 'Water'],
  ['Metagross', 'Epic', 'Grass'],
  ['Garchomp', 'Epic', 'Water'],
  ['Hydreigon', 'Epic', 'Fire'],
  ['Gardevoir', 'Epic', 'Grass'],
  ['Slaking', 'Epic', 'Water'],
  ['Tyranitar', 'Epic', 'Fire'],
  ['Salamence', 'Epic', 'Grass'],
  ['Gengar', 'Epic', 'Fire'],
  ['Charizard', 'Rare', 'Fire'],
  ['Raichu', 'Rare', 'Grass'],
  ['Starmie', 'Rare', 'Water'],
  ['Blastoise', 'Rare', 'Water'],
  ['Ninetales', 'Rare', 'Fire'],
  ['Venusaur', 'Rare', 'Grass'],
  ['Shiny Mewtwo', 'Shiny Mythic', 'Dark'],
  ['Shiny Mew', 'Shiny Mythic', 'Light'],
  ['Shiny Kyogre', 'Shiny Mythic', 'Light'],
  ['Shiny Darkrai', 'Shiny Mythic', 'Dark'],
  ['Shiny Arceus', 'Shiny Mythic', 'Light'],
  ['Shiny Kyurem', 'Shiny Mythic', 'Dark'],
  ['Shiny Hoopa', 'Shiny Mythic', 'Dark'],
  ['Shiny Cresselia', 'Shiny Mythic', 'Light'],
];

/** Stat-only talents repeated across the sheet (tier II/III/IV rows). */
const strength = (pct, atk) => [
  { field: 'hp', mult: 1 + pct },
  { field: atk, mult: 1 + pct },
];
const critLine = (crit, critRes, critPower, block, blockPower, guardBreak) => {
  const mods = [];
  if (crit) mods.push({ field: 'crit', add: crit });
  if (critRes) mods.push({ field: 'critRes', add: critRes });
  if (critPower) mods.push({ field: 'critPower', add: critPower });
  if (block) mods.push({ field: 'block', add: block });
  if (blockPower) mods.push({ field: 'blockPower', add: blockPower });
  if (guardBreak) mods.push({ field: 'guardBreak', add: guardBreak });
  return mods;
};
/** Mage line (Rares/Epics): crit + crit power, some block/guard break. */
const mageLine = (crit, critPower, block, guardBreak) =>
  critLine(crit, 0, critPower, block, 0, guardBreak);

/**
 * Ported kits for the 17 creatures with captured skills. Every entry is a best
 * effort translation of the sheet into the five-slot content DSL: single-target
 * = `column`, frontline/backline = `row`, "N random" = `random` + `targets`,
 * "entire team" = `all`, and named statuses map to engine control kinds
 * (Freeze/Stun -> control, Paralyze -> paralysis, Confuse -> confusion,
 * Flinch -> silence, Burn/Poison -> a `dot` skill). Effects with no DSL home
 * (ally-wide buffs, rage generation, cleanse, conditional talents) are dropped;
 * see docs/design/roster-import.md.
 */
const PORTED = {
  Calyrex: {
    class: 'striker',
    skills: {
      normal: { type: 'P', rates: [1.1], rule: 'column' },
      basic: { type: 'P', rates: [1.2], rule: 'column', control: { kind: 'freeze', chance: 0.4, turns: 1 } },
      ult: { type: 'P', rates: [1.0], rule: 'all', targetDebuffs: [{ tag: 'frost', field: 'spd', amount: -25, turns: 1 }] },
    },
    talents: {
      statMods: [
        ...strength(0.4, 'pAtk'),
        ...critLine(0.06, 0.22, 0.06, 0.6, 0.25, 0.15),
      ],
      rageOnHit: 125,
      rageCutChance: 0.5,
    },
  },
  Meganium: {
    class: 'adept',
    skills: {
      normal: { type: 'S', rates: [1.0], rule: 'column' },
      basic: { type: 'S', rates: [1.2], rule: 'column', heal: { target: 'ally', rate: 0.08 } },
      ult: { type: 'S', rates: [1.2], rule: 'column', heal: { target: 'allies', rate: 0.18 } },
    },
    talents: { statMods: [...strength(0.25, 'sAtk'), ...critLine(0.1, 0.08, 0.125, 0.06, 0.06, 0.425)] },
  },
  Dragonite: {
    class: 'adept',
    skills: {
      normal: { type: 'S', rates: [1.0], rule: 'column' },
      basic: { type: 'S', rates: [1.2], rule: 'column' },
      ult: { type: 'S', rates: [1.35], rule: 'row' },
    },
    talents: { statMods: [...strength(0.25, 'sAtk'), ...critLine(0.5, 0.1, 0.135, 0.06, 0.06, 0.135)] },
  },
  Metagross: {
    class: 'striker',
    skills: {
      normal: { type: 'P', rates: [1.0], rule: 'column' },
      basic: { type: 'P', rates: [1.2], rule: 'column', control: { kind: 'confusion', chance: null, turns: 1 } },
      ult: { type: 'P', rates: [2.1], rule: 'column', control: { kind: 'confusion', chance: 0.3, turns: 1 } },
    },
    talents: {
      statMods: [...strength(0.25, 'pAtk'), ...critLine(0.06, 0.425, 0.06, 0.09, 0.1, 0.08)],
      rageOnHit: 125,
      rageCutChance: 0.5,
    },
  },
  Garchomp: {
    class: 'striker',
    skills: {
      normal: { type: 'P', rates: [1.0], rule: 'column' },
      basic: {
        type: 'P',
        rates: [1.2],
        rule: 'column',
        targetDebuffs: [{ tag: 'vulnerability', field: 'dmgRdct', amount: -0.1, turns: 2 }],
      },
      ult: {
        type: 'P',
        rates: [1.35],
        rule: 'row',
        targetDebuffs: [{ tag: 'defDown', field: 'dmgRdct', amount: -0.35, turns: 2 }],
      },
    },
    talents: {
      statMods: [...strength(0.25, 'pAtk'), ...critLine(0.06, 0.425, 0.06, 0.09, 0.1, 0.08)],
      rageOnHit: 125,
      rageCutChance: 0.5,
    },
  },
  Hydreigon: {
    class: 'striker',
    skills: {
      normal: { type: 'P', rates: [1.0], rule: 'column' },
      basic: { type: 'P', rates: [1.2], rule: 'column' },
      ult: { type: 'P', rates: [1.9], rule: 'row', selfBuffs: [{ tag: 'dmgUp', field: 'dmgBoost', amount: 0.1, turns: 2 }] },
    },
    talents: { statMods: [...strength(0.25, 'pAtk'), ...critLine(0.1, 0.08, 0.125, 0.06, 0.06, 0.425)] },
  },
  Gardevoir: {
    class: 'adept',
    skills: {
      normal: { type: 'S', rates: [1.0], rule: 'column' },
      basic: {
        type: 'S',
        rates: [1.2],
        rule: 'column',
        targetDebuffs: [{ tag: 'defDown', field: 'dmgRdct', amount: -0.1, turns: 1 }],
      },
      ult: {
        type: 'S',
        rates: [1.35],
        rule: 'row',
        targetDebuffs: [{ tag: 'defDown', field: 'dmgRdct', amount: -0.1, turns: 2 }],
      },
    },
    talents: {
      statMods: [...strength(0.25, 'sAtk'), ...critLine(0.08, 0.08, 0.11, 0.06, 0.06, 0.38), { field: 'dmgRdct', add: 0.1 }],
    },
  },
  Slaking: {
    class: 'striker',
    skills: {
      normal: { type: 'P', rates: [1.0], rule: 'column' },
      basic: { type: 'P', rates: [1.2], rule: 'column' },
      ult: { type: 'P', rates: [1.9], rule: 'random', targets: 2, heal: { target: 'self', rate: 0.09 } },
    },
    talents: {
      statMods: [...strength(0.25, 'pAtk'), ...critLine(0.06, 0.08, 0.06, 0.45, 0.125, 0.08)],
      safeguard: { active: 1, cycle: 99 },
    },
  },
  Tyranitar: {
    class: 'striker',
    skills: {
      normal: { type: 'P', rates: [1.0], rule: 'column' },
      basic: { type: 'P', rates: [1.2], rule: 'column', control: { kind: 'stun', chance: null, turns: 1 } },
      ult: {
        type: 'P',
        rates: [1.35],
        rule: 'random',
        targets: 3,
        control: { kind: 'stun', chance: 0.15, turns: 1 },
        targetDebuffs: [{ tag: 'ctrlResDown', field: 'controlRes', amount: -0.12, turns: 2 }],
      },
    },
    talents: {
      statMods: [...strength(0.25, 'pAtk'), ...critLine(0.06, 0.425, 0.06, 0.09, 0.1, 0.08)],
      rageOnHit: 125,
      rageCutChance: 0.5,
    },
  },
  Salamence: {
    class: 'striker',
    skills: {
      normal: { type: 'P', rates: [1.0], rule: 'column' },
      basic: { type: 'P', rates: [1.2], rule: 'column', lifesteal: 0.1 },
      ult: { type: 'P', rates: [2.1], rule: 'column', lifesteal: 0.3 },
    },
    talents: { statMods: [...strength(0.25, 'pAtk'), ...critLine(0.45, 0.08, 0.12, 0.06, 0.06, 0.1)] },
  },
  Gengar: {
    class: 'adept',
    skills: {
      normal: { type: 'S', rates: [1.0], rule: 'column' },
      basic: { type: 'S', rates: [1.2], rule: 'column', control: { kind: 'silence', chance: null, turns: 1 } },
      ult: { type: 'S', rates: [1.35], rule: 'row', control: { kind: 'silence', chance: null, turns: 1 } },
    },
    talents: { statMods: [...strength(0.25, 'sAtk'), ...critLine(0.45, 0.08, 0.12, 0.06, 0.06, 0.1)] },
  },
  Charizard: {
    class: 'striker',
    skills: {
      normal: { type: 'P', rates: [1.0], rule: 'column' },
      basic: { type: 'P', rates: [1.2], rule: 'column' },
      ult: { type: 'P', rates: [1.35], rule: 'row', selfBuffs: [{ tag: 'offerOfPower', field: 'dmgBoost', amount: 0.5, turns: 1 }] },
    },
    talents: { statMods: [...strength(0.18, 'pAtk'), ...critLine(0.4, 0.08, 0.1, 0, 0, 0.1)] },
  },
  Raichu: {
    class: 'adept',
    skills: {
      normal: { type: 'S', rates: [1.0], rule: 'column' },
      basic: { type: 'S', rates: [1.2], rule: 'column', control: { kind: 'paralysis', chance: 0.25, turns: 1 } },
      ult: { type: 'S', rates: [1.45], rule: 'random', targets: 3, control: { kind: 'paralysis', chance: 0.15, turns: 1 } },
    },
    talents: { statMods: [...strength(0.18, 'sAtk'), ...critLine(0.4, 0.08, 0.1, 0, 0, 0.1)] },
  },
  Starmie: {
    class: 'striker',
    skills: {
      normal: { type: 'P', rates: [1.0], rule: 'column' },
      basic: { type: 'P', rates: [1.35], rule: 'column' },
      ult: { type: 'P', rates: [1.35], rule: 'random', targets: 3 },
    },
    talents: { statMods: [...strength(0.18, 'pAtk'), ...mageLine(0.08, 0.1, 0.06, 0.35)] },
  },
  Blastoise: {
    class: 'guardian',
    skills: {
      normal: { type: 'P', rates: [1.0], rule: 'column' },
      basic: { type: 'P', rates: [1.2], rule: 'column', selfBuffs: [{ tag: 'pdmgred', field: 'dmgRdct', amount: 0.1, turns: 2 }] },
      ult: { type: 'P', rates: [1.35], rule: 'row', selfBuffs: [{ tag: 'pdmgred', field: 'dmgRdct', amount: 0.18, turns: 3 }] },
    },
    talents: {
      statMods: [...strength(0.18, 'pAtk'), ...critLine(0, 0.08, 0, 0.4, 0.115, 0.08)],
      rageOnHit: 125,
    },
  },
  Ninetales: {
    class: 'adept',
    skills: {
      normal: { type: 'S', rates: [1.0], rule: 'column' },
      basic: { type: 'S', rates: [1.35], rule: 'column' },
      ult: { type: 'S', rates: [1.35], rule: 'row', damageType: 'dot', hpShare: 0.05 },
    },
    talents: { statMods: [...strength(0.18, 'sAtk'), ...mageLine(0.08, 0.1, 0.06, 0.35)] },
  },
  Venusaur: {
    class: 'adept',
    skills: {
      normal: { type: 'S', rates: [1.0], rule: 'column' },
      basic: { type: 'S', rates: [1.2], rule: 'column', damageType: 'dot', hpShare: 0.03 },
      ult: { type: 'S', rates: [0.9], rule: 'random', targets: 4, damageType: 'dot', hpShare: 0.03 },
    },
    talents: { statMods: [...strength(0.18, 'sAtk'), ...mageLine(0.08, 0.1, 0.06, 0.35)] },
  },
};

const TIER_BY_RARITY = {
  Rare: 'rare',
  Epic: 'epic',
  Legendary: 'legendary',
  Supreme: 'supreme',
  Mythic: 'mythic',
  Origin: 'mythic',
  'Shiny Mythic': 'mythic',
};

const TIER_MULT = { common: 0.65, rare: 1, epic: 1.35, legendary: 1.8, supreme: 2.4, mythic: 3.2 };

const CLASS_BASE = {
  striker: { hp: 950, pAtk: 130, sAtk: 60, spd: 110, pDef: 65, sDef: 60 },
  adept: { hp: 1150, pAtk: 66, sAtk: 122, spd: 103, pDef: 100, sDef: 108 },
  guardian: { hp: 1400, pAtk: 105, sAtk: 73, spd: 92, pDef: 130, sDef: 130 },
};

const CLASS_CYCLE = ['striker', 'guardian', 'adept'];

/** The sheet lists final forms only, so growth stages are generated. */
function evolutionStages(name) {
  return [name, `${name} Prime`, `${name} Zenith`];
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hash(text) {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function baseStats(className, tier) {
  const t = TIER_MULT[tier];
  const raw = CLASS_BASE[className];
  const out = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Math.round(v * t);
  return out;
}

/** Canonical kits per class (same shapes the M2 roster shipped). */
function kitFor(id, name, faction, className, tier) {
  const skills =
    className === 'striker'
      ? {
          normal: { type: 'P', rates: [1], rule: 'column' },
          basic: { type: 'P', rates: [1.2], rule: 'column' },
          ult: { type: 'P', rates: [1.7, 1.4], rule: 'row' },
        }
      : className === 'guardian'
        ? {
            normal: {
              type: 'S',
              rates: [0.95],
              rule: 'column',
              selfBuffs: [{ tag: 'bulwark', field: 'dmgRdct', amount: 0.1, turns: 2 }],
            },
            basic: { type: 'S', rates: [1.15], rule: 'column' },
            ult: { type: 'S', rates: [1.6], rule: 'row' },
          }
        : {
            normal: { type: 'S', rates: [1], rule: 'column' },
            basic: {
              type: 'S',
              rates: [1.15],
              rule: 'row',
              targetDebuffs: [{ tag: 'chill', field: 'dmgRdct', amount: -0.15, turns: 2 }],
            },
            ult: {
              type: 'S',
              rates: [1.7],
              rule: 'row',
              targetDebuffs: [{ tag: 'daze', field: 'spd', amount: -40, turns: 2 }],
            },
          };

  const talents =
    className === 'striker'
      ? { statMods: [{ field: 'pAtk', mult: 1.15 }, { field: 'sAtk', mult: 1.15 }, { field: 'crit', add: 0.05 }] }
      : className === 'guardian'
        ? {
            statMods: [
              { field: 'hp', mult: 1.2 },
              { field: 'dmgRdct', add: 0.08 },
              { field: 'block', add: 0.05 },
            ],
            rageOnHit: 125,
          }
        : {
            statMods: [
              { field: 'sAtk', mult: 1.15 },
              { field: 'controlBoost', add: 0.1 },
              { field: 'healBoost', add: 0.1 },
            ],
          };

  return { id, name, faction, class: className, tier, skills, talents };
}

const speciesByFaction = Object.fromEntries(FILES.map((f) => [f, []]));
const kitsByFaction = Object.fromEntries(FILES.map((f) => [f, []]));

let lightCounter = 0;
let index = 0;
for (const [name, rarity, attribute] of ROSTER) {
  index += 1;
  const faction =
    attribute === 'Fire'
      ? 'ember'
      : attribute === 'Water'
        ? 'tide'
        : attribute === 'Grass'
          ? 'grove'
          : attribute === 'Dark'
            ? 'shade'
            : lightCounter++ % 2 === 0
              ? 'volt'
              : 'frost';
  const id = slug(name);
  const port = PORTED[name];
  const className = port ? port.class : CLASS_CYCLE[index % CLASS_CYCLE.length];
  const tier = TIER_BY_RARITY[rarity];
  speciesByFaction[faction].push({
    id,
    name,
    faction,
    class: className,
    tier,
    description: `${name}, a ${rarity.toLowerCase()} ${attribute.toLowerCase()} Wild from the owner's collection.`,
    paletteSeed: 1000 + (hash(id) % 9000),
    stages: evolutionStages(name),
    base: baseStats(className, tier),
  });

  const kit = kitFor(id, name, faction, className, tier);
  if (port) {
    kit.skills = port.skills;
    kit.talents = port.talents;
  }
  kitsByFaction[faction].push(kit);
}

for (const faction of FILES) {
  writeFileSync(resolve(contentDir, 'species', `${faction}.json`), `${JSON.stringify(speciesByFaction[faction], null, 2)}\n`);
  writeFileSync(resolve(contentDir, 'kits', `${faction}.json`), `${JSON.stringify(kitsByFaction[faction], null, 2)}\n`);
  console.log(`${faction}: ${speciesByFaction[faction].length} species, ${kitsByFaction[faction].length} kits`);
}
