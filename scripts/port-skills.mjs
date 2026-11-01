/* eslint-disable no-undef */
// Faithful kit port (M9.6). Turns the owner's captured skills sheet
// (scripts/data/pokemon-skills.json — scraped from the wiki: 84 creatures ×
// Basic Attack / Basic Skill / Ult / Passive / Talent 1–4 = 579 rows) into the
// shipped kits at packages/content/kits/<faction>.json.
//
//   node scripts/port-skills.mjs
//
// Run it *after* scripts/import-roster.mjs (which owns species, classes and
// tiers): this script keeps every kit's id/name/faction/class/tier and replaces
// only its skills + talents. It never invents a mechanic the sheet does not
// state — a clause it cannot express is counted in docs/PORT-REPORT.md instead
// of being approximated. The sheet's LV.2/LV.3 upgrade notes are recorded as
// "upgrade text" (the game has no per-skill level track yet; ASSUMPTIONS 13).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = resolve(root, 'packages/content');
// R1: kits are grouped by the source's five factions.
const FILES = ['water', 'fire', 'grass', 'light', 'dark'];
const SHEET = resolve(root, 'scripts/data/pokemon-skills.json');
const REPORT = resolve(root, 'docs/PORT-REPORT.md');

// ------------------------------------------------------------------- helpers
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const num = (v) => Number.parseFloat(v);
const pct = (v) => num(v) / 100;
/** E3: a Rage amount as written: "1/8" → 125 (shares of the 1,000-point bar), "300" → 300. */
const rageAmount = (v) => {
  const frac = String(v).match(/(\d+)\s*\/\s*(\d+)/);
  return frac ? Math.round((1000 * Number(frac[1])) / Number(frac[2])) : Number(v);
};

const MARK = '\u0001';
/**
 * Split a sheet string into clauses. `fine` also splits on commas (skill
 * descriptions, where each clause is a mechanic); coarse splits only on `.` and
 * `;` so a talent's "When attacked, ..." prefix stays with its payload.
 * "S.ATK" / "P.DEF" and decimals are protected from the split.
 */
function splitClauses(text, fine) {
  const guarded = String(text)
    .replace(/(\d)\.(\d)/g, `$1${MARK}$2`)
    .replace(/\b([PS])\.\s?(ATK|DEF)\b/gi, `$1${MARK}$2`);
  return guarded
    .split(fine ? /[.;,]/ : /[;.]/)
    .map((c) => c.split(MARK).join('.').trim())
    .filter((c) => c.length > 1);
}

function normKey(clause) {
  return clause
    .toLowerCase()
    .replace(/\d+(\.\d+)?/g, 'N')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Where a clause's effect points: enemy (default), ally or self. */
function edgeSide(clause) {
  // "self S.ATK" / "own max HP" name the *source* of a value, not the target.
  const c = clause
    .toLowerCase()
    .replace(/\b(?:self|own|its own|your own)\s+(?=s?\.?atk|p?\.?atk|attack|hp\b|health|max\b|speed)/g, '');
  if (/yourself|\bself\b|\bown\b/.test(c)) return 'self';
  if (/all(y|ies)|teammate|team-?mate|partner|whole team/.test(c)) return 'ally';
  // "gain/recover [X]" with no opposing target is the caster acting on itself
  if (/\b(gain|gains|recover|regenerates|regain)\b/.test(c) && !/enemy|opponent|target\b/.test(c)) return 'self';
  return 'enemy';
}

// ---------------------------------------------------------------- stat fields
const FIELD = {
  hp: 'hp',
  'max hp': 'hp',
  'maximum hp': 'hp',
  'p.atk': 'pAtk',
  's.atk': 'sAtk',
  atk: 'pAtk',
  spd: 'spd',
  speed: 'spd',
  crit: 'crit',
  critical: 'crit',
  'crit rate': 'crit',
  'crit chance': 'crit',
  'critical chance': 'crit',
  'crit dmg reduction': 'critRes',
  'crit res': 'critRes',
  'critical res': 'critRes',
  'crit resist': 'critRes',
  'crit resistance': 'critRes',
  'crit intensity': 'critPower',
  'crit int': 'critPower',
  'critical intensity': 'critPower',
  'critical int': 'critPower',
  'crit dmg': 'critPower',
  'crit damage': 'critPower',
  block: 'block',
  'block intensity': 'blockPower',
  'block int': 'blockPower',
  'blocking intensity': 'blockPower',
  'block strength': 'blockPower',
  // E3: the sheet's other spellings ("15% Crit strength, 51% Break", "P.ATK DMG Reduction").
  'crit strength': 'critPower',
  'critical strength': 'critPower',
  break: 'guardBreak',
  'block break': 'guardBreak',
  'p.atk dmg reduction': 'pRdct',
  'p.atk damage reduction': 'pRdct',
  's.atk dmg reduction': 'sRdct',
  's.atk damage reduction': 'sRdct',
  'block reduction': 'block',
  'guard break': 'guardBreak',
  'dmg reduction': 'dmgRdct',
  'damage reduction': 'dmgRdct',
  'dmg rdct': 'dmgRdct',
  'dmg boost': 'dmgBoost',
  'damage boost': 'dmgBoost',
  'dmg dealt': 'dmgBoost',
  'ultimate damage': 'ultBoost',
  'ult damage': 'ultBoost',
  'ultimate dmg': 'ultBoost',
  'skill damage': 'skillBoost',
  'skill dmg': 'skillBoost',
  'dmg multiplier': 'dmgBoost',
  'control res': 'controlRes',
  'control resistance': 'controlRes',
  'control hit': 'controlBoost',
  'control boost': 'controlBoost',
  heal: 'healBoost',
  healing: 'healBoost',
  'heal boost': 'healBoost',
  'healing boost': 'healBoost',
  'heal amount': 'healBoost',
  'received healing': 'receiveHealBoost',
  'healing received': 'receiveHealBoost',
  reflection: 'counterBoost',
  'damage reflection': 'counterBoost',
  'damage taken': 'dmgRdct',
  'dmg taken': 'dmgRdct',
  'damage received': 'dmgRdct',
  'hp absorption': 'healBoost',
  'life absorption': 'healBoost',
  'lifesteal': 'healBoost',
};

/** Stat names that are multiplicative *increases*; everything else is additive. */
const MULT_FIELDS = new Set(['hp', 'pAtk', 'sAtk']);

const CONTROL_KINDS = [
  [/freez|frozen/i, 'freeze'],
  [/stun/i, 'stun'],
  [/paralyz|paralysis/i, 'paralysis'],
  [/silenc/i, 'silence'],
  [/confus/i, 'confusion'],
  [/flinch/i, 'flinch'],
  [/petrif/i, 'petrify'],
  [/put\s+\w+\s+to\s+sleep|sleep|asleep|\bnap\b|nightmare/i, 'sleep'],
  [/imprison|confinement|dark prison|confined/i, 'confinement'],
  [/taunt/i, 'taunt'],
  [/disarm/i, 'disarm'],
  [/ensnar|snared/i, 'ensnare'],
  [/unable to (move|act|attack)|immobiliz/i, 'control'],
];

// -------------------------------------------------------------- target parse
function parseTarget(phrase) {
  const p = ` ${String(phrase).toLowerCase()} `;
  const out = { rule: 'column' };
  const nRandom = p.match(/(\d+)\s+random/);
  if (/\b(all|entire|whole)\b[\s\S]*\b(enem|target|unit|team)|all enemies|enemy team/.test(p)) {
    out.rule = 'all';
  } else if (/front ?-?line|front row|front-?row/.test(p)) {
    out.rule = 'frontline';
  } else if (/back ?-?line|back row|rear row|a back |the back/.test(p)) {
    out.rule = 'backline';
  } else if (/random/.test(p)) {
    out.rule = 'random';
    out.n = Number(nRandom?.[1] ?? 1);
  } else if (/lowest (hp|health|life)|least (hp|health|life)/.test(p)) {
    out.rule = 'lowest_hp';
  } else if (/highest atk|highest attack|most atk|highest p\.atk|highest s\.atk/.test(p)) {
    out.rule = 'highest_atk';
  } else if (/highest (hp|health|life)/.test(p)) {
    out.rule = 'highest_hp';
  } else if (/highest spd|highest speed|fastest/.test(p)) {
    out.rule = 'highest_spd';
  } else if (/same row|a row|whole row|entire row|horizontal|in a line|front and back|enem\w*'?s?\s*row|targets?'?s?\s*row/.test(p)) {
    out.rule = 'row';
  } else if (/same (position|column)|symmetric/.test(p)) {
    out.rule = 'same_position';
  } else if (/adjacent|neighbou?r/.test(p)) {
    out.rule = 'adjacent';
  }
  if (out.rule === 'random' && !out.n) out.n = 1;
  return out;
}

// ------------------------------------------------------------ stat pair scan
const ARTICLE = /^(?:own|your|the|its|his|her|their|additional|all|each|every|both|target'?s?|enemy'?s?|attacker'?s?|self'?s?|opponent'?s?|teammates?'?)\s+/i;

/** Resolve a stat name from prose: drop leading articles, then find the longest
 * contiguous run of words that names a known stat ("all allies' ATK" -> pAtk). */
function fieldFor(name) {
  const words = String(name)
    .trim()
    .toLowerCase()
    // "the healing the opponent receives" is about healing *received*
    .replace(/healing\s+(?:the\s+)?(?:opponent|target|enemy|unit|they|it)?\s*receives?/, 'healing received')
    .replace(/[:.]$/, '')
    .replace(ARTICLE, '')
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    for (let j = words.length; j > i; j -= 1) {
      const key = words.slice(i, j).join(' ');
      if (FIELD[key]) return FIELD[key];
    }
  }
  return null;
}

function segPairStatFirst(seg) {
  const m = seg.match(
    /^\s*(?:increas(?:e|es|ing)|gain(?:s|ing)?|boost(?:s|ing)?|enhanc(?:e|es|ing)|add(?:s|ing)?|reduce[sd]?|steal(?:s|ing)?|applies?)?\s*(?:the |its |own |your |his |her )?([A-Za-z][A-Za-z. ']{1,40}?)\s+(?:increases?\s+|is\s+increased\s+|is\s+)?by\s+(?:a\s+further\s+|an?\s+additional\s+|an?\s+extra\s+)?(\d+(?:\.\d+)?)\s*(%|percent|points?)?/i,
  );
  if (!m) return null;
  const field = fieldFor(m[1]);
  if (!field) return null;
  const flat = /point/i.test(m[3] ?? '');
  return { field, value: flat ? num(m[2]) : pct(m[2]), flat };
}

function segPairValueFirst(seg) {
  const m = seg.match(
    /^\s*(?:each (?:layer|mark|stack|buff|level) )?(?:adds?|provides?|gives?|increases?|grants?|boosts?|enhances?|gains?|steals?|increase|gain|steal)?\s*(\d+(?:\.\d+)?)\s*%\s*([A-Za-z][A-Za-z. ']{1,40})/i,
  );
  if (!m) return null;
  const field = fieldFor(m[2]);
  if (!field) return null;
  return { field, value: pct(m[1]), flat: false };
}

const LEADING_VERB =
  /^\s*(?:each (?:layer|mark|stack|buff|level) (?:of\s+\w+\s+)?)?(?:increas(?:e|es|ing)|gain(?:s|ing)?|boost(?:s|ing)?|enhanc(?:e|es|ing)|add(?:s|ing)?|reduce[sd]?|reducing|lower(?:s|ing)?|decreas(?:e|es|ing)|shred(?:s|ing)?|provides?|gives?|steals?|applies?)\s+/i;

/**
 * Every "<stat> by <value>[%|points]" pair in a clause, in order. Handles both
 * orders ("Increases HP by 18%", "Gains 12% DMG Reduction") across comma/and
 * separated lists.
 */
function statPairs(clause) {
  const out = [];
  const segs = String(clause).split(/\s*(?:,|\band\b|\/)\s*/);
  for (let i = 0; i < segs.length; i += 1) {
    const seg = segs[i];
    let pair = segPairStatFirst(seg) ?? segPairValueFirst(seg);
    if (!pair && i === 0) {
      const afterVerb = seg.replace(LEADING_VERB, '');
      if (afterVerb !== seg) pair = segPairStatFirst(afterVerb) ?? segPairValueFirst(afterVerb);
    }
    if (!pair && i === 0) {
      // a leading verb may sit *after* the stat ("HP increases by 40%")
      const stripped = seg.replace(ARTICLE, '');
      pair = segPairStatFirst(stripped);
    }
    if (pair) out.push(pair);
  }
  return out;
}

// --------------------------------------------------------------- rule engine
function makeBuilder(slot) {
  return { slot, type: null, rates: [], target: { rule: 'column' }, targetSet: false, effects: [], shape: undefined };
}

function addEffect(b, effect) {
  b.effects.push({ at: b.effects.length, effect });
}

function effectTarget(b, clause) {
  const side = edgeSide(clause);
  const c = clause.toLowerCase();
  if (side === 'self') return { rule: 'self' };
  if (side === 'ally') {
    const back = /back ?-?line|back row|rear row/.test(c);
    const rule = /lowest|least/.test(c)
      ? 'lowest_hp'
      : /allies|teammates|whole team|entire team/.test(c)
        ? 'all'
        : 'column';
    return { side: 'ally', rule, ...(back ? { rowFilter: 'back' } : {}) };
  }
  return { ...b.target };
}

// --- primary / secondary damage
const DMG_VERB = /(?:attacks?|damages?|deals?|dealing|caus(?:e|es|ing)|inflicts?|inflict|hits?)\b/i;
const DMG_TYPE = '(P\\.ATK|S\\.ATK|ATK|physical|magical|magic|damage|dmg)';

function damageTypeOf(what) {
  const w = what.toLowerCase();
  if (w === 's.atk' || w === 'magical' || w === 'magic') return 'S';
  if (w === 'p.atk' || w === 'physical') return 'P';
  return null;
}

function scanDamage(b, clause) {
  // A clause right after "... which ignites after one turn" is the delayed
  // detonation damage, not a second simultaneous hit.
  if (b.detonate && /^\s*(?:and\s+)?(?:dealing|deals?|damages?)\b/i.test(clause)) {
    const m = clause.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%\\s*${DMG_TYPE}`, 'i'));
    if (m) {
      addEffect(b, {
        op: 'dot',
        target: { ...b.target },
        tag: b.lastTag ?? 'detonation',
        dot: {
          share: pct(m[1]),
          basis: 'casterAtk',
          type: damageTypeOf(m[2]) ?? b.type ?? 'P',
          turns: 1,
        },
      });
      b.detonate = false;
      return true;
    }
  }
  // A clause that describes over-time damage is a DoT definition, not a hit.
  if (/true damage/i.test(clause) && /for\s+\d+\s*turns?/i.test(clause)) return false;
  if (/\b(?:per|each|every)\s+(?:turn|round)\b/i.test(clause)) return false;
  // (a) target first: "Attacks all enemies, dealing 80% P.ATK DMG"
  const first = clause.match(
    new RegExp(`^\\s*(?:and\\s+)?${DMG_VERB.source}\\s+(?:an?\\s+)?(.+?)[\\s,]+(?:and\\s+(?:then\\s+)?)?(?:dealing|deals?|for|with|to deal)[\\s,]+(?:an?\\s+)?(?:additional\\s+)?(\\d+(?:\\.\\d+)?)\\s*%\\s*${DMG_TYPE}`, 'i'),
  );
  // (b) damage first: "Deals 135% P.ATK damage to the front row"
  const second = clause.match(
    new RegExp(`^\\s*(?:and\\s+)?(?:${DMG_VERB.source})\\s+(?:an?\\s+)?(?:additional\\s+)?(\\d+(?:\\.\\d+)?)\\s*%\\s*${DMG_TYPE}\\s*(?:DMG|damage|dmg)?\\s*(?:to|on|for)?\\s*(.*)$`, 'i'),
  );
  // (c) target first with no connector: "Deals enemies'row 160% S.ATK damage"
  const third = clause.match(
    new RegExp(`^\\s*(?:and\\s+)?(?:${DMG_VERB.source})\\s+(?:an?\\s+)?(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*%\\s*${DMG_TYPE}`, 'i'),
  );
  let rate;
  let type;
  let targetPhrase;
  // The target phrase must be a target, not the damage clause itself.
  const firstOk = first && !/%|\bP\.ATK\b|\bS\.ATK\b/i.test(first[1]);
  const thirdOk = third && !/%|\bP\.ATK\b|\bS\.ATK\b/i.test(third[1]);
  if (firstOk) {
    targetPhrase = first[1].trim();
    rate = pct(first[2]);
    type = damageTypeOf(first[3]);
  } else if (thirdOk) {
    targetPhrase = third[1].trim();
    rate = pct(third[2]);
    type = damageTypeOf(third[3]);
  } else if (second) {
    rate = pct(second[1]);
    type = damageTypeOf(second[2]);
    targetPhrase = (second[3] ?? '').trim();
  } else {
    return false;
  }
  if (b.rates.length === 0) {
    b.type = type;
    b.target = targetPhrase ? parseTarget(targetPhrase) : (b.preTarget ?? { rule: 'column' });
    b.targetSet = true;
  }
  b.rates.push(rate);
  return true;
}

// --- "% of max/current/missing HP" damage
function scanHpDamage(b, clause) {
  const m = clause.match(
    /(\d+(?:\.\d+)?)\s*%\s*of\s+(?:the\s+)?(?:target'?s?|enemy'?s?|opponent'?s?|its own|own|self'?s?|caster'?s?)?\s*(max(?:imum)?\s*(?:HP|health|life)|current\s*HP|missing\s*HP|lost\s*HP|remaining\s*HP)/i,
  );
  if (!m) return false;
  if (!/damage|dmg|deal|adds?\b|inflict|equal to/i.test(clause)) return false;
  const key = m[2].toLowerCase();
  const basis =
    key.startsWith('current') || key.startsWith('remaining')
      ? 'targetCurrentHp'
      : key.startsWith('missing') || key.startsWith('lost')
        ? 'targetMissingHp'
        : 'targetMaxHp';
  addEffect(b, { op: 'damage', target: effectTarget(b, clause), basis, share: pct(m[1]), ...(/true damage/i.test(clause) ? { trueDamage: true } : {}) });
  return true;
}

// --- control
function scanControl(b, clause) {
  if (/burn|blaze|flame|magma/i.test(clause)) return false;
  let found = false;
  for (const [re, kind] of CONTROL_KINDS) {
    if (!re.test(clause)) continue;
    // Prefer the % next to "chance"/"probability"; fall back to a lone %.
    const pcts = [...clause.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => num(m[1]));
    const chanceM = clause.match(/(\d+(?:\.\d+)?)\s*%\s*(?:chance|probability)/i);
    const chance = chanceM ? num(chanceM[1]) : pcts.length === 1 ? pcts[0] : undefined;
    const turnsM = clause.match(/(\d+)\s*(?:turns?|rounds?)/i);
    addEffect(b, {
      op: 'control',
      target: effectTarget(b, clause),
      control: {
        kind,
        chance: chance !== undefined && chance < 100 ? pct(chance) : null,
        ...(turnsM ? { turns: Number(turnsM[1]) } : {}),
      },
    });
    found = true;
  }
  return found;
}

// --- a cost the caster pays itself ("deducts 20% of current HP")
function scanSelfCost(b, clause) {
  if (!/\b(deduct|deducts|consume|consumes|cost|costs|sacrifice|pay|pays|lose|loses)\b/i.test(clause)) return false;
  if (/target|enemy|opponent/i.test(clause)) return false;
  const m = clause.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:the\s+)?)?(current\s+|max(?:imum)?\s+)?(?:HP|health|life)/i);
  if (!m) return false;
  addEffect(b, {
    op: 'damage',
    target: { rule: 'self' },
    basis: /current/i.test(m[2] ?? '') ? 'targetCurrentHp' : 'targetMaxHp',
    share: pct(m[1]),
  });
  return true;
}

// --- a marked target taking scheduled damage ("the mark deals 90% of self S.ATK")
function scanMarkDot(b, clause) {
  const m = clause.match(/\b(?:the\s+|this\s+)?mark\s+deals?\s+(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:self\s+|own\s+|its\s+)?(S\.ATK|P\.ATK|ATK)/i);
  if (!m) return false;
  addEffect(b, {
    op: 'dot',
    target: effectTarget(b, clause),
    tag: 'mark',
    dot: {
      share: pct(m[1]),
      basis: 'casterAtk',
      type: m[2].toUpperCase() === 'S.ATK' ? 'S' : 'P',
      // The sheet stages the mark across turns ("end of turn 1 … 90%",
      // "end of turn 2 … 115%"); each staged line becomes its own one-tick
      // DoT so the total number of ticks matches the sheet.
      turns: 1,
      ...(/can'?t be dispelled|cannot be dispelled|undispellable/i.test(clause) ? { undispellable: true } : {}),
    },
  });
  return true;
}

// --- a delayed detonation ("... which ignites after one turn")
function scanDetonation(b, clause) {
  if (!/\bignit|detonat/i.test(clause)) return false;
  b.detonate = true;
  return true;
}

// --- damage over time
function scanDot(b, clause) {
  // Only clauses with a genuine over-time signal become DoTs: a tick rate
  // ("per turn"), or true damage over turns. A bare "add a layer of burning"
  // is tracked as a mark instead (see scanResource) rather than inventing a
  // damage figure the sheet does not state there.
  const tick = /per turn|each turn|every turn|per round|each round|every round|over \d+ turns?|at the end of (?:each |every |the )?turn|at the end of turn \d+/i.test(clause);
  const trueDot = /true damage/i.test(clause) && /for\s+\d+\s*turns?/i.test(clause);
  const named = clause.match(/\[([A-Za-z][A-Za-z ']{1,24})\]/);
  if (!tick && !trueDot) return false;
  const dmg = clause.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!dmg && !named) return false;
  const hpM = clause.match(
    /of\s+(?:the\s+)?(?:target'?s?|enemy'?s?|own|self'?s?)?\s*(max(?:imum)?\s*(?:HP|health|life)|current\s*HP|missing\s*HP|\bHP\b)/i,
  );
  const atkM = clause.match(/\b(P\.ATK|S\.ATK|ATK)\b/i);
  const basis = hpM ? (hpM[1].toLowerCase().startsWith('current') ? 'targetCurrentHp' : 'targetMaxHp') : 'casterAtk';
  const turnsM = clause.match(/(\d+)\s*(?:turns?|rounds?)/i);
  const tagText = named?.[1] ?? clause.match(/(burn|poison|bleed|frostbite|toxic|scorch|leech seed|curse)/i)?.[1] ?? b.lastTag ?? 'dot';
  addEffect(b, {
    op: 'dot',
    target: effectTarget(b, clause),
    tag: tagText.trim().toLowerCase().replace(/\s+/g, '-'),
    dot: {
      share: dmg ? pct(dmg[1]) : 0.03,
      basis,
      ...(atkM ? { type: atkM[1].toUpperCase() === 'S.ATK' ? 'S' : 'P' } : {}),
      ...(turnsM ? { turns: Number(turnsM[1]) } : {}),
      ...(/true damage/i.test(clause) ? { trueDamage: true } : {}),
      ...(/can'?t be dispelled|cannot be dispelled|undispellable/i.test(clause) ? { undispellable: true } : {}),
    },
  });
  return true;
}

// --- shields
function scanShield(b, clause) {
  if (!/shield|absorb/i.test(clause)) return false;
  const m = clause.match(/(\d+(?:\.\d+)?)\s*%/i);
  if (!m) return false;
  const basis = /p\.atk|\bs\.atk\b|\batk\b/i.test(clause) ? 'casterAtk' : 'casterHp';
  addEffect(b, { op: 'shield', target: effectTarget(b, clause), share: pct(m[1]), basis });
  return true;
}

// --- heals (incl. regen over turns)
function scanHeal(b, clause) {
  if (!/heal|restore|recover|regenerat|regain|returns?\b/i.test(clause)) return false;
  if (/rage|energy/i.test(clause)) return false; // Rage/energy restore is a `rage` effect
  if (/reduc|decreas|lower|prevent|no healing|cannot be healed|prohibit/i.test(clause)) return false; // a heal *nerf*
  if (/convert|absorption|into healing|of damage into/i.test(clause)) return false; // lifesteal (scanShape)
  if (/\bdamage\b|\bdmg\b/i.test(clause)) return false;
  const m = clause.match(/(\d+(?:\.\d+)?)\s*%/i);
  if (!m) return false;
  const overTurns = clause.match(/(\d+)\s*turns?/i);
  const regen = /per turn|each turn|over \d+ turn|for \d+ turn/i.test(clause);
  addEffect(b, {
    op: 'heal',
    target: effectTarget(b, clause),
    rate: pct(m[1]),
    basis: /p\.atk|\bs\.atk\b/i.test(clause) && !/max/i.test(clause) ? 'casterAtk' : 'targetMaxHp',
    ...(regen && overTurns ? { over: Number(overTurns[1]) } : {}),
  });
  return true;
}

// --- Rage: drained from the enemy, or regenerated for the caster
function scanRage(b, clause) {
  if (!/rage/i.test(clause)) return false;
  const drain = /reduc|drain|steal|decreas|remov|lose|loses|burn|burned|cost/i.test(clause);
  if (!drain && !/regenerat|gain|restore|recover|grant/i.test(clause)) return false;
  // The figure must sit next to "Rage" ("reduces rage by 300", "regenerates
  // 100% Rage") — not any stray percentage elsewhere in the clause.
  const m =
    clause.match(/(?:rage|bar)\s+by\s+(\d+(?:\.\d+)?)\s*(%|points?)?/i) ||
    clause.match(/(\d+(?:\.\d+)?)\s*(%|points?)?\s*(?:of\s+)?(?:the\s+)?(?:target'?s?\s+|attacker'?s?\s+|self\s+)?(?:rage|bar)/i);
  if (!m) return false;
  const isPct = /%/.test(m[2] ?? '');
  const value = isPct ? pct(m[1]) : num(m[1]);
  const chanceM = clause.match(/(\d+(?:\.\d+)?)\s*%\s*(?:chance|probability)/i);
  addEffect(b, {
    op: 'rage',
    target: drain ? effectTarget(b, clause) : { rule: 'self' },
    ...(isPct ? { pct: drain ? -value : value } : { delta: drain ? -value : value }),
    ...(drain && /steal/i.test(clause) ? { steal: true } : {}),
    ...(drain && chanceM ? { chance: pct(chanceM[1]) } : {}),
  });
  return true;
}

// --- cleanse / dispel
function scanClean(b, clause) {
  const cleanse = /purif|cleanse|clears?[\s\S]*control|remov[\s\S]*control|clear[\s\S]*negative|remov[\s\S]*debuff|remov[\s\S]*negative/i.test(clause);
  const dispel = /(?:clear|dispel|remov)[\s\S]*(?:opponent|enemy)[\s\S]*buff|dispel[\s\S]*buff/i.test(clause);
  if (!cleanse && !dispel) return false;
  const countM = clause.match(/(\d+)\s*(?:of\s+)?(?:its own\s+)?(?:negative\s+)?(?:buff|debuff|status)/i) || clause.match(/up to\s+(\d+)/i);
  addEffect(b, { op: cleanse ? 'cleanse' : 'dispel', target: effectTarget(b, clause), ...(countM ? { count: Number(countM[1]) } : {}) });
  return true;
}

// --- named stacks / marks ("[Frost]", "layers of [sanction]") and named
// statuses applied without an inline damage definition ("add 1 layer of burning")
function scanResource(b, clause) {
  const m = clause.match(/\[([A-Za-z][A-Za-z ']{1,24})\]/) ?? clause.match(/"([A-Za-z][A-Za-z ']{1,24})"/);
  const status = clause.match(/\b(burning|poison|bleed|frostbite|toxic|scorch|leech seed|curse)\b/i);
  const name = m?.[1] ?? status?.[1];
  if (!name) return false;
  if (/shield/i.test(name)) return false;
  // A clause about a mark's *rules* ("can't be removed", "stacks up to 20") is a
  // modifier on the previous mark, not a new application.
  if (/can'?t be removed|cannot be removed|not removed|no cap|stack(?:s)? up to|maximum|up to \d+/i.test(clause) && !/\b(add|gain|inflict|apply|increase|consum|reduc|lose|shortage)/i.test(clause)) {
    return false;
  }
  if (!m && !/inflict|add|apply|layer|stack/i.test(clause)) return false; // only when the status is applied
  const consume = /consum|remov|lose|loses|shortage/i.test(clause) && !/gives?|gains?|adds?|inflicts?|appl(?:y|ies)|stack of|layer of/i.test(clause);
  const n = clause.match(/(\d+)\s*(?:layer|stack|level)/i);
  const tag = name.trim().toLowerCase().replace(/\s+/g, '-');
  // A later clause may define what the mark does without repeating its name.
  b.lastTag = tag;
  addEffect(b, {
    op: 'resource',
    target: effectTarget(b, clause),
    tag,
    ...(consume ? { consume: n ? Number(n[1]) : 1 } : { delta: n ? Number(n[1]) : 1 }),
  });
  return true;
}

// --- stat debuffs on the target
function scanDebuff(b, clause) {
  const turnsM = clause.match(/for\s+(\d+)\s*(?:turns?|rounds?)/i);
  const turns = turnsM ? Number(turnsM[1]) : 2;
  // Healing prohibition is its own debuff field.
  if (/cannot be healed|can'?t be healed|no healing|prevents? (?:all )?healing|ban on healing|healing is prohibited|healing.{0,12}prohibited/i.test(clause)) {
    addEffect(b, {
      op: 'buff',
      target: effectTarget(b, clause),
      buff: { tag: 'heal-block', kind: 'stat', field: 'receiveHealBoost', amount: -1, turns },
    });
    return true;
  }
  if (/damage taken|dmg taken|damage received/i.test(clause) && /increas|more damage/i.test(clause)) {
    const m = clause.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) {
      addEffect(b, {
        op: 'buff',
        target: effectTarget(b, clause),
        buff: { tag: 'shred-dmgRdct', kind: 'stat', field: 'dmgRdct', amount: -pct(m[1]), turns },
      });
      return true;
    }
  }
  if (!/reduce|decreas|lower|shred|diminish|steal/i.test(clause)) return false;
  const pairs = statPairs(clause);
  if (pairs.length === 0) return false;
  const undispellable = /can'?t be dispelled|cannot be dispelled/i.test(clause);
  for (const p of pairs) {
    addEffect(b, {
      op: 'buff',
      target: effectTarget(b, clause),
      buff: { tag: `shred-${p.field}`, kind: 'stat', field: p.field, amount: -p.value, turns, ...(undispellable ? { undispellable: true } : {}) },
    });
    // a steal also grants the owner what the target loses
    if (/steal/i.test(clause)) {
      addEffect(b, {
        op: 'buff',
        target: { rule: 'self' },
        buff: { tag: `steal-${p.field}`, kind: 'stat', field: p.field, amount: p.value, turns },
      });
    }
  }
  return true;
}

// --- buffs that scale with the caster's own named marks ("each layer adds …")
function scanMarkBuff(b, clause) {
  if (!/each (?:layer|mark|stack|level)\b/i.test(clause)) return false;
  if (!/adds?|increas|provides?|grants?|boosts?/i.test(clause)) return false;
  const pairs = statPairs(clause);
  if (pairs.length === 0) return false;
  for (const p of pairs) {
    addEffect(b, {
      op: 'buff',
      target: { rule: 'self' },
      buff: { tag: `mark-${p.field}`, kind: 'stat', field: p.field, amount: p.value, turns: 99 },
    });
  }
  return true;
}

// --- buffs on self / allies
function scanBuff(b, clause) {
  if (/reduce|decreas|lower|shred|diminish/i.test(clause)) return false;
  // A conditional damage rider ("increasing the damage against backline enemies
  // by 25%") is not a flat stat buff; it is recorded, not approximated.
  if (/\bagainst\b|\bversus\b|\bvs\b|when attacking/i.test(clause)) return false;
  if (/damage taken|dmg taken|damage received/i.test(clause)) return false; // a vulnerability debuff
  // "The damage is increased by a further 20%" — the caster's own output.
  if (/^(?:the |its )?damage (?:is )?increased by/i.test(clause.trim())) {
    const m = clause.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) {
      addEffect(b, {
        op: 'buff',
        target: { rule: 'self' },
        buff: { tag: 'self-dmgBoost', kind: 'stat', field: 'dmgBoost', amount: pct(m[1]), turns: 2 },
      });
      return true;
    }
  }
  if (!/increas|gain|grant|boost|enhanc/i.test(clause)) return false;
  const pairs = statPairs(clause);
  if (pairs.length === 0) return false;
  const turnsM = clause.match(/for\s+(\d+)\s*(?:turns?|rounds?)/i);
  const stacksM = clause.match(/stack(?:s|ing)?\s+up\s+to\s+(\d+)|up to\s+(\d+)\s*(?:level|stack|layer)/i);
  // An unqualified positive change ("increase Ultimate damage by 50%") is the
  // caster buffing itself; a debuff-style clause naming a target stays on the
  // skill's own targets.
  const named = /target|enemy|opponent/i.test(clause);
  const side = edgeSide(clause);
  const target = side === 'enemy' && !named ? { rule: 'self' } : effectTarget(b, clause);
  for (const p of pairs) {
    addEffect(b, {
      op: 'buff',
      target,
      buff: {
        tag: `${side === 'enemy' && !named ? 'self' : side === 'enemy' ? 'mark' : 'boon'}-${p.field}`,
        kind: 'stat',
        field: p.field,
        amount: p.value,
        turns: turnsM ? Number(turnsM[1]) : 2,
        ...(stacksM ? { maxStacks: Number(stacksM[1] ?? stacksM[2]) } : {}),
        ...(/can'?t be dispelled|cannot be dispelled/i.test(clause) ? { undispellable: true } : {}),
      },
    });
  }
  return true;
}

/** "Stacks up to N times" / "Lasts N turns" / "Cannot be dispelled" modify the
 * effect the previous clause just added. */
function scanModifier(b, clause) {
  const stacksM = clause.match(
    /stack(?:s|ing)?\s+up\s+to\s+(\d+)|up to\s+(\d+)\s*(?:layer|stack|level|time)|(?:max(?:imum)?(?:\s+of)?)\s+(\d+)\s*(?:stack|layer|level|time)/i,
  );
  const turnsM = clause.match(/(?:lasts?|lasting)\s+(\d+)\s*(?:turns?|rounds?)/i);
  const undisp = /can'?t be dispelled|cannot be dispelled|undispellable/i.test(clause);
  const noStack = /cannot be stacked|can'?t be stacked/i.test(clause);
  if (!stacksM && !turnsM && !undisp && !noStack) return false;
  const n = noStack ? 1 : stacksM ? Number(stacksM[1] ?? stacksM[2] ?? stacksM[3]) : undefined;
  const turns = turnsM ? Number(turnsM[1]) : undefined;
  const last = (() => {
    // A modifier clause that names a mark ("[sanction] … stacks up to 20")
    // belongs to that mark, not to whatever effect came last.
    const mark = clause.match(/\[([A-Za-z][A-Za-z ']{1,24})\]/);
    if (mark) {
      const tag = mark[1].trim().toLowerCase().replace(/\s+/g, '-');
      for (let i = b.effects.length - 1; i >= 0; i -= 1) {
        const e = b.effects[i].effect;
        if (e.op === 'resource' && (e.tag === tag || tag.includes(e.tag))) return e;
      }
    }
    return b.effects[b.effects.length - 1]?.effect;
  })();
  if (!last) {
    b.loose = (b.loose ?? 0) + 1; // a modifier clause with nothing yet to attach to
    return true;
  }
  if (last.op === 'buff') {
    if (n) last.buff.maxStacks = n;
    if (turns && !last.buff.turns) last.buff.turns = turns;
    if (undisp) last.buff.undispellable = true;
  } else if (last.op === 'dot') {
    if (n) last.dot.maxStacks = n;
    if (turns && !last.dot.turns) last.dot.turns = turns;
    if (undisp) last.dot.undispellable = true;
  } else if (last.op === 'control') {
    if (turns && !last.control.turns) last.control.turns = turns;
  } else if (last.op === 'resource') {
    if (n) last.max = n;
  } else if (last.op === 'heal') {
    if (n) last.over = n;
  }
  return true; // a pure modifier clause is always consumed
}

/** "gain immunity to control / all damage". */
function scanImmune(b, clause) {
  if (!/immun/i.test(clause)) return false;
  const turnsM = clause.match(/(\d+)\s*(?:turns?|rounds?)/i);
  if (/damage|dmg/i.test(clause)) {
    addEffect(b, {
      op: 'buff',
      target: effectTarget(b, clause),
      buff: { tag: 'immune-damage', kind: 'stat', field: 'dmgRdct', amount: 1, turns: turnsM ? Number(turnsM[1]) : 1 },
    });
    return true;
  }
  addEffect(b, {
    op: 'buff',
    target: effectTarget(b, clause),
    buff: { tag: 'immunity', kind: 'immune', turns: turnsM ? Number(turnsM[1]) : 1 },
  });
  return true;
}

/** Clauses that change the skill's own shape rather than adding an effect. */
function scanShape(b, clause) {
  if (/convert|chain|of damage into|damage into healing/i.test(clause) && /heal/i.test(clause)) {
    const m = clause.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) {
      // A line can repeat the figure for each stage of a multi-stage mark
      // (Rayquaza: 10% then 60%); keep the first and let the rest fall through.
      if (b.shape?.lifesteal === undefined) b.shape = { ...(b.shape ?? {}), lifesteal: pct(m[1]) };
      return true;
    }
  }
  if (/ignor\w*[\s\S]*(?:defen|\bS?\.?DEF\b)/i.test(clause)) {
    const m = clause.match(/(\d+(?:\.\d+)?)\s*%/);
    b.shape = { ...(b.shape ?? {}), ignoreDefense: m ? pct(m[1]) : 1 };
    return true;
  }
  if (/ignor\w*[\s\S]*shield|breaks?[\s\S]*shield|bypass\w*[\s\S]*shield/i.test(clause)) {
    b.shape = { ...(b.shape ?? {}), ignoreShield: true };
    return true;
  }
  if (/release again|cast again|recast/i.test(clause) && /kill|die|death/i.test(clause)) {
    const m = clause.match(/up to\s+(\d+)|(\d+)\s*times/i);
    b.shape = { ...(b.shape ?? {}), recastOnKill: { max: Number(m?.[1] ?? m?.[2] ?? 1) } };
    return true;
  }
  return false;
}

const RULES = [
  ['markDot', scanMarkDot],
  ['damage', scanDamage],
  ['hpDamage', scanHpDamage],
  ['selfCost', scanSelfCost],
  ['detonation', scanDetonation],
  ['control', scanControl],
  ['dot', scanDot],
  ['shield', scanShield],
  ['heal', scanHeal],
  ['rageDrain', scanRage],
  ['cleanse', scanClean],
  ['resource', scanResource],
  ['debuff', scanDebuff],
  ['markBuff', scanMarkBuff],
  ['buff', scanBuff],
  ['immune', scanImmune],
  ['shape', scanShape],
  ['modifier', scanModifier],
];

// ------------------------------------------------------------- slot finalizer
// Set per creature by the main loop: the attack type implied by the creature's
// own lines when a damage clause names no stat.
let atkHint = null;

function atkTypeHint(creature) {
  const text = creature.slots.map((s) => s.desc ?? '').join(' ');
  const phys = /\bP\.ATK\b/i.test(text);
  const mag = /\bS\.ATK\b/i.test(text);
  if (phys && !mag) return 'P';
  if (mag && !phys) return 'S';
  return null;
}

const CLASS_FALLBACK = {
  striker: { normal: { type: 'P', rates: [1], rule: 'column' }, basic: { type: 'P', rates: [1.2], rule: 'column' }, ult: { type: 'P', rates: [1.7, 1.4], rule: 'row' } },
  guardian: { normal: { type: 'S', rates: [0.95], rule: 'column' }, basic: { type: 'S', rates: [1.15], rule: 'column' }, ult: { type: 'S', rates: [1.6], rule: 'row' } },
  adept: { normal: { type: 'S', rates: [1], rule: 'column' }, basic: { type: 'S', rates: [1.15], rule: 'row' }, ult: { type: 'S', rates: [1.7], rule: 'row' } },
};

function finalizeSkill(b, kit, rep) {
  const effects = b.effects.map((e) => e.effect);
  const out = {};
  // Bare "deals N% damage" lines carry no P./S. signal; the creature's own
  // lines decide the type (a P.ATK talent means a physical attacker), else the
  // class default applies.
  const fallbackType = atkHint ?? (kit.class === 'striker' ? 'P' : 'S');
  if (b.rates.length === 0) {
    if (effects.length === 0) {
      const fb = CLASS_FALLBACK[kit.class][b.slot];
      rep.fallback(`${kit.id}.${b.slot}`);
      return { type: fb.type, rates: [...fb.rates], rule: fb.rule };
    }
    rep.count('skill: support slot (no attack line, rates 0)');
    out.type = b.type ?? fallbackType;
    out.rates = [0];
    out.rule = 'column';
  } else {
    out.type = b.type ?? fallbackType;
    out.rates = b.rates;
    out.rule = b.target.rule;
    if (b.target.n) out.targets = b.target.n;
  }
  if (b.shape) Object.assign(out, b.shape);
  if (effects.length > 0) out.effects = effects;
  if (b.loose) rep.count('skill: modifier clause with no preceding effect');
  return out;
}

function parseSkillSlot(slot, desc, kit, rep) {
  CURRENT.sheetSlot = SHEET_SLOT[slot];
  CURRENT.clause = desc;
  const b = makeBuilder(slot);
  const cl = splitClauses(desc, true);
  // Some slots state the target in its own clause ("Attacks all enemies")
  // before the clause that names the damage.
  const targetLine = cl.find((c) => /^\s*(?:and\s+)?attacks?\b/i.test(c) && !/\d/.test(c));
  if (targetLine) b.preTarget = parseTarget(targetLine);
  const hit = cl.map((clause) => {
    let ok = false;
    for (const [name, fn] of RULES) {
      if (fn(b, clause)) {
        rep.consume(`skill:${name}`);
        ok = true;
      }
    }
    return ok;
  });
  cl.forEach((clause, i) => {
    CURRENT.clause = clause;
    if (hit[i]) return;
    // A clause that is only a phase marker ("After using Ultimates", "On a
    // crit") carries no mechanic of its own — its riders are the next clauses.
    if (triggerOn(clause)) {
      rep.count('skill: phase marker (no effect of its own)');
      return;
    }
    // A clause that only restates the target ("Attacks all enemies") adds
    // nothing: the attack line already set the target.
    if (/^\s*(?:and\s+)?attacks?\b/i.test(clause) && !/\d/.test(clause)) {
      rep.count('skill: target-only line (target already set by the attack line)');
      return;
    }
    rep.residual(clause, `${kit.id}.${slot}`);
  });
  return finalizeSkill(b, kit, rep);
}

// -------------------------------------------------------------------- talents
function triggerOn(clause) {
  const c = clause.toLowerCase();
  if (/when engaged|upon entering battle|at the (start|beginning) of (the )?battle|enters? the battle|entering combat|when a battle begins/.test(c)) return 'battleStart';
  if (/killed by a direct|when[\s\S]*kill|after[\s\S]*kill|kills? a target|upon kill|on kill/.test(c)) return 'onKill';
  if (/when[\s\S]*(dies|is dead|death)|on death/.test(c)) return /all(y|ies)|teammate/.test(c) ? 'onAllyDeath' : 'onDeath';
  if (/when[\s\S]*(get hit|gets hit|attacked|being hit|receiving damage|takes? damage|damaged)|after being hit|when hit/.test(c)) return 'onHit';
  if (/at (?:your|the) turn start|at the (start|beginning) of (each|every|the|your) turn|beginning of each turn/.test(c)) return 'turnStart';
  if (/at the end of (each|every|the|your) turn|end of each turn|after (each|every) turn/.test(c)) return 'turnEnd';
  if (/at the end of turn \d+|at the end of the (first|second|third|fourth) turn/.test(c)) return 'turnEnd';
  if (/after using (?:the )?ult|after each ult|after releasing the ult|after using ultimates/.test(c)) return 'turnEnd';
  if (/at the end of (each|every|the)?\s*round/.test(c)) return 'roundEnd';
  if (/at the (start|beginning) of (each|every)\s*round/.test(c)) return 'roundStart';
  if (/hp is below|hp below|life is below|health below|when hp falls|below (\d+)% (of )?(max )?(hp|life|health)/.test(c)) return 'hpBelow';
  if (/^when |^if |^upon |^after /.test(c)) return 'turnStart';
  return null;
}

function parseTriggerClause(clause, rep) {
  const on = triggerOn(clause);
  if (!on) return null;
  const sub = makeBuilder('trigger');
  let payload = false;
  for (const [name, fn] of RULES) {
    if (name === 'damage' || name === 'hpDamage' || name === 'shape') continue;
    if (fn(sub, clause)) {
      rep.consume(`trigger:${name}`);
      payload = true;
    }
  }
  const rageM = clause.match(/gain[s]?\s+(\d+)\s*(?:points?\s*)?(?:of\s*)?rage/i);
  if (rageM && /gain/i.test(clause)) payload = true;
  if (!payload) {
    rep.count('trigger: recognised event with no expressible payload');
    return {}; // recognised, but nothing to attach
  }
  const chanceM = clause.match(/(\d+(?:\.\d+)?)\s*%\s*chance/i);
  const capM = clause.match(/up to\s+(\d+)\s*times|(\d+)\s*times per turn/i);
  const hpM = clause.match(/below\s+(\d+(?:\.\d+)?)\s*%/i) || clause.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:max|maximum)\s+)?(?:HP|health|life)?[\s\S]*below/i);
  return {
    on,
    ...(sub.effects.length > 0 ? { effects: sub.effects.map((e) => e.effect) } : {}),
    ...(rageM ? { rage: Number(rageM[1]) } : {}),
    ...(chanceM ? { chance: pct(chanceM[1]) } : {}),
    ...(capM ? { perTurn: Number(capM[1] ?? capM[2]) } : {}),
    ...(on === 'hpBelow' && hpM ? { hpBelow: pct(hpM[1]) } : {}),
  };
}

function parseTalents(creature, kit, rep) {
  const talents = { statMods: [], triggers: [] };
  for (const s of creature.slots) {
    if (!s.slot.startsWith('Talent') && s.slot !== 'Passive') continue;
    const before = { statMods: talents.statMods.length, triggers: talents.triggers.length };
    CURRENT.sheetSlot = s.slot;
    for (const clause of splitClauses(s.desc, false)) {
      CURRENT.clause = clause;
      const c = clause.toLowerCase();

      // E3: "start with half of the rage bar filled" is the same Rage I opening.
      if (/gain (half|full) rage|rage when engaged|start with (half|full) of the rage bar/.test(c)) {
        talents.rageStart = /full/.test(c) ? 1000 : 500;
        rep.consume('talent:rageStart');
        continue;
      }
      if (/get hit/.test(c) && /rage/.test(c)) {
        // E3 fix: "1/8 additional Rage" is a share of the 1,000-point bar (125), not 1 point.
        const m = clause.match(/(\d+\s*\/\s*\d+|\d+)\s*additional rage/i);
        if (m) talents.rageOnHit = rageAmount(m[1]);
        rep.consume('talent:rageOnHit');
        continue;
      }
      if (/chance to reduce the attacker'?s rage/.test(c)) {
        const m = clause.match(/(\d+(?:\.\d+)?)\s*%/);
        if (m) talents.rageCutChance = pct(m[1]);
        rep.consume('talent:rageCutChance');
        continue;
      }
      // E3: "The chance to trigger a minor skill is increased by 20% (default is 20%)" → 40%.
      if (/chance to trigger a minor skill is increased by/.test(c)) {
        const m = clause.match(/increased by\s+(\d+(?:\.\d+)?)\s*%[^]*default is\s+(\d+(?:\.\d+)?)\s*%/i);
        if (m) talents.basicRate = pct(m[1]) + pct(m[2]);
        rep.consume('talent:basicRate');
        continue;
      }
      if (/triggering rate|trigger probability|triggering probability/.test(c)) {
        const m = clause.match(/\+(\d+(?:\.\d+)?)\s*%/) || clause.match(/(\d+(?:\.\d+)?)\s*%/);
        if (m) talents.basicRate = pct(m[1]);
        rep.consume('talent:basicRate');
        continue;
      }
      // E3: per-action Rage ("Normal attacks/basic skills generate 1/2 additional Rage",
      // "Gain 1/4 additional Rage whenever you use basic attacks/basic skills", "Ultimates generate
      // 1/4 Rage") — shares of the 1,000-point bar, granted after the action.
      if (/additional rage|ultimates generate|generate \d/.test(c) && /rage/.test(c)) {
        const m = clause.match(/(\d+\s*\/\s*\d+|\d+)\s*(?:additional\s+)?rage/i);
        const amount = m ? rageAmount(m[1]) : 0;
        const ons = /ultimate/.test(c) ? ['afterUlt'] : ['afterNormal', 'afterBasic'];
        if (amount > 0) {
          for (const on of ons) talents.triggers.push({ on, rage: amount });
          rep.consume('talent: per-action Rage');
          continue;
        }
      }
      if (/convert[^]*of damage into healing|damage into healing/.test(c)) {
        rep.count('talent: damage-to-healing conversion (not modelled)');
        continue;
      }
      if (/cooldown|^cd[: ]/i.test(c) && /\d/.test(c) && /cd|cooldown/i.test(c)) {
        const m = clause.match(/(\d+)\s*(?:turns?|rounds?)/i) || clause.match(/(?:cd|cooldown)[: ]*(\d+)/i);
        const lastTrigger = talents.triggers[talents.triggers.length - 1];
        if (m && lastTrigger) lastTrigger.cooldown = Number(m[1]);
        rep.consume('talent: cooldown on the preceding trigger');
        continue;
      }
      if (/stacks? up to|can'?t be dispelled|cannot be dispelled|works up to|cannot be stacked|can'?t be stacked|(?:lasts?|lasting)\s+\d+|up to\s+\d+\s*(?:layer|stack|level|time)|max(?:imum)?\s+(?:of\s+)?\d+\s*(?:layer|stack|level)/.test(c)) {
        rep.count('talent: modifier on the preceding clause');
        continue;
      }
      if (/upon entering battle|on entering combat|when engaged|entering combat/.test(c)) {
        const pairs = statPairs(clause);
        const turnsM = clause.match(/for\s+(\d+)\s*(?:turns?|rounds?)/i);
        if (pairs.length > 0) {
          talents.triggers.push({
            on: 'battleStart',
            effects: pairs.map((p) => ({
              op: 'buff',
              target: { rule: 'self' },
              buff: { tag: `engage-${p.field}`, kind: 'stat', field: p.field, amount: p.value, turns: turnsM ? Number(turnsM[1]) : 99 },
            })),
          });
          rep.consume('talent: battle-start buff');
          continue;
        }
      }
      if (/per turn|each turn|every turn/.test(c) && /all (allies|teammates)|for all allies|to all teammates/.test(c)) {
        const pairs = statPairs(clause);
        const cap = clause.match(/(?:up to(?:\s+a)?(?:\s+maximum of)?|max(?:imum)?(?:\s+of)?)\s+(\d+)/i);
        if (pairs.length > 0) {
          talents.triggers.push({
            on: 'turnStart',
            effects: pairs.map((p) => ({
              op: 'buff',
              target: { side: 'ally', rule: 'all' },
              buff: {
                tag: `ally-${p.field}`,
                kind: 'stat',
                field: p.field,
                amount: p.value,
                turns: 99,
                ...(cap ? { maxStacks: Number(cap[1]) } : {}),
              },
            })),
          });
          rep.consume('talent: per-turn ally buff');
          continue;
        }
      }
      if (/per turn|each turn|every turn/.test(c) && /increas|boost|gain/.test(c) && /stack|up to|maximum/.test(c)) {
        const pairs = statPairs(clause);
        const cap = clause.match(/up to\s+(\d+)\s*(?:level|stack|layer)|maximum of\s+(\d+)|max\s+(\d+)\s*(?:level|stack)/i);
        if (pairs.length > 0) {
          talents.triggers.push({
            on: 'turnStart',
            effects: pairs.map((p) => ({
              op: 'buff',
              target: { rule: 'self' },
              buff: {
                tag: `tick-${p.field}`,
                kind: 'stat',
                field: p.field,
                amount: p.value,
                turns: 99,
                ...(cap ? { maxStacks: Number(cap[1] ?? cap[2] ?? cap[3]) } : {}),
              },
            })),
          });
          rep.consume('talent: per-turn stacking buff');
          continue;
        }
      }

      const trig = parseTriggerClause(clause, rep);
      if (trig) {
        if (trig.on) {
          talents.triggers.push(trig);
          rep.consume('talent: trigger');
        }
        continue;
      }

      const pairs = statPairs(clause);
      if (pairs.length > 0 && !/deals?\b|damage to|to a single|to all |attacks?\b/.test(c)) {
        for (const p of pairs) {
          talents.statMods.push(MULT_FIELDS.has(p.field) ? { field: p.field, mult: 1 + p.value } : { field: p.field, add: p.value });
        }
        rep.consume('talent: stat bundle');
        continue;
      }

      // Last resort: a passive clause that is just an effect ("Be immune to
      // Burning and Blaze", "reduces damage taken by 20%"). Resolve it as a
      // battle-start trigger so the unit carries it from the opening turn.
      const sub = makeBuilder('passive');
      for (const [name, fn] of RULES) {
        if (name === 'damage' || name === 'hpDamage' || name === 'shape' || name === 'modifier') continue;
        if (fn(sub, clause)) rep.consume(`passive:${name}`);
      }
      if (sub.effects.length > 0 && sub.effects.every((e) => e.effect.target?.side !== 'enemy')) {
        talents.triggers.push({ on: 'battleStart', effects: sub.effects.map((e) => e.effect) });
        rep.consume('talent: passive effect (battleStart)');
        continue;
      }

      rep.residual(clause, `${kit.id}.${s.slot}`);
    }
    // E3: remember which sheet slot each entry came from, so a hand port can replace that slot.
    for (const m of talents.statMods.slice(before.statMods)) Object.defineProperty(m, '_slot', { value: s.slot });
    for (const t of talents.triggers.slice(before.triggers)) Object.defineProperty(t, '_slot', { value: s.slot });
  }
  if (talents.statMods.length === 0) delete talents.statMods;
  if (talents.triggers.length === 0) delete talents.triggers;
  return talents;
}

// ------------------------------------------------------------- E3 hand ports
/**
 * `scripts/data/kit-overrides.json`: per kit, the sheet slots written by hand (`slots`; `also` = slots
 * whose parsed entries stay and are only added to), whole skill
 * replacements (`skills`), talent entries replacing the parsed ones of those slots (`statMods`,
 * `triggers`, `damageMods`) and plain talent fields (`set`). Clauses of a hand-ported slot count as
 * modelled in the report.
 */
const OVERRIDES = JSON.parse(readFileSync(resolve(root, 'scripts/data/kit-overrides.json'), 'utf8'));
const SHEET_SLOT = { normal: 'Basic Attack', basic: 'Basic Skill', ult: 'Ult' };
const CURRENT = { kit: '', sheetSlot: '', clause: '' };

function isHandPorted() {
  const o = OVERRIDES[CURRENT.kit];
  return Boolean(o && [...(o.slots ?? []), ...(o.also ?? [])].includes(CURRENT.sheetSlot));
}

/**
 * E3: "+10% S.ATK" / "ATK −8%" buffs were written as flat P.ATK/S.ATK adds of 0.1 / −0.08 points.
 * A share of attack is the `atkPct` stat (it raises both attacks; a unit only uses its own type).
 */
function fixAttackPercents(node) {
  if (Array.isArray(node)) return node.forEach(fixAttackPercents);
  if (!node || typeof node !== 'object') return;
  if ((node.field === 'pAtk' || node.field === 'sAtk') && typeof node.amount === 'number' && Math.abs(node.amount) < 5) {
    node.field = 'atkPct';
  }
  for (const v of Object.values(node)) fixAttackPercents(v);
}

function applyOverride(kit) {
  const o = OVERRIDES[kit.id];
  if (!o) return;
  const slots = new Set(o.slots ?? []);
  for (const [slot, def] of Object.entries(o.skills ?? {})) kit.skills[slot] = def;
  const t = kit.talents ?? {};
  for (const key of ['statMods', 'triggers']) {
    const kept = (t[key] ?? []).filter((e) => !slots.has(e._slot));
    const next = [...kept, ...(o[key] ?? [])];
    if (next.length > 0) t[key] = next;
    else delete t[key];
  }
  if (o.damageMods) t.damageMods = o.damageMods;
  if (o.levels) kit.levels = o.levels;
  Object.assign(t, o.set ?? {});
  if (Object.keys(t).length > 0) kit.talents = t;
  else delete kit.talents;
}

// ------------------------------------------------------------------ reporting
function makeReport() {
  const residual = new Map();
  const counts = new Map();
  const fallbacks = [];
  const perKit = new Map();
  const handPorted = (name) => counts.set(`OK  ${name}`, (counts.get(`OK  ${name}`) ?? 0) + 1);
  return {
    consume: (name) => counts.set(`OK  ${name}`, (counts.get(`OK  ${name}`) ?? 0) + 1),
    count: (name) => {
      if (isHandPorted()) return handPorted(`hand-ported (kit-overrides.json): ${name.replace(/ \(not modelled\)/, '')}`);
      counts.set(`--- ${name}`, (counts.get(`--- ${name}`) ?? 0) + 1);
    },
    fallback: (where) => fallbacks.push(where),
    residual(clause, where) {
      if (isHandPorted()) return handPorted('hand-ported (kit-overrides.json): unparsed clause');
      const key = normKey(clause);
      if (key.length < 3) return;
      const entry = residual.get(key) ?? { count: 0, example: clause, where: new Set() };
      entry.count += 1;
      entry.where.add(where);
      residual.set(key, entry);
      const kitId = where.split('.')[0];
      perKit.set(kitId, (perKit.get(kitId) ?? 0) + 1);
    },
    counts,
    fallbacks,
    perKit,
    get residualMap() {
      return residual;
    },
  };
}

// ----------------------------------------------------------------------- main
if (process.argv[2] === '--debug') {
  const text = process.argv.slice(3).join(' ');
  const b = makeBuilder('debug');
  for (const clause of splitClauses(text, true)) {
    const matched = [];
    for (const [name, fn] of RULES) if (fn(b, clause)) matched.push(name);
    console.log(`[${matched.join(',') || 'NONE'}] ${clause}`);
  }
  console.log(JSON.stringify(b, null, 2));
  process.exit(0);
}

const sheet = JSON.parse(readFileSync(SHEET, 'utf8'));
const kitsByFaction = Object.fromEntries(FILES.map((f) => [f, JSON.parse(readFileSync(resolve(contentDir, 'kits', `${f}.json`), 'utf8'))]));
const kitBySlug = new Map();
for (const f of FILES) for (const k of kitsByFaction[f]) kitBySlug.set(k.id, k);

const rep = makeReport();
const unmatched = [];
const seen = new Set();

for (const creature of sheet) {
  const kit = kitBySlug.get(slug(creature.name));
  if (!kit) {
    unmatched.push(creature.name);
    continue;
  }
  seen.add(kit.id);
  CURRENT.kit = kit.id;
  const bySlot = new Map(creature.slots.map((s) => [s.slot, s]));
  const slotFor = (name) => bySlot.get(name)?.desc ?? '';
  atkHint = atkTypeHint(creature);
  kit.skills = {
    normal: parseSkillSlot('normal', slotFor('Basic Attack'), kit, rep),
    basic: parseSkillSlot('basic', slotFor('Basic Skill'), kit, rep),
    ult: parseSkillSlot('ult', slotFor('Ult'), kit, rep),
  };
  const talents = parseTalents(creature, kit, rep);
  if (Object.keys(talents).length > 0) kit.talents = talents;
  else delete kit.talents;
  fixAttackPercents(kit.skills);
  fixAttackPercents(kit.talents?.triggers);
  applyOverride(kit);
  // R6a: plate skills (scripts/data/build-kit-overrides.py `plate(...)`), for any kit.
  const plate = OVERRIDES._plates?.[kit.id];
  if (plate) kit.plate = plate;
  // R6b: exclusive-trinket skills (scripts/data/trinket-skills.py `trinket(...)`).
  const trinket = OVERRIDES._trinkets?.[kit.id];
  if (trinket) kit.trinket = trinket;

  for (const s of creature.slots) {
    CURRENT.sheetSlot = '';
    if (s.notes && s.notes.trim()) {
      // E4: the Origins' LV.2 / LV.3 rows are hand-ported as kit `levels`.
      if (OVERRIDES[kit.id]?.levels) rep.consume('E4: Origin skill level text (kit levels)');
      else rep.count('sheet LV.2+ upgrade text (not modelled)');
    }
  }
}

const unported = [...kitBySlug.keys()].filter((id) => !seen.has(id));

for (const f of FILES) {
  writeFileSync(resolve(contentDir, 'kits', `${f}.json`), `${JSON.stringify(kitsByFaction[f], null, 2)}\n`);
}

const lines = [];
lines.push('# Skill port report (M9.6, E3)');
lines.push('');
lines.push('Generated by `node scripts/port-skills.mjs` from `scripts/data/pokemon-skills.json`.');
lines.push(`Source rows: **${sheet.length}** creatures, **${sheet.reduce((n, c) => n + c.slots.length, 0)}** skill rows.`);
lines.push(`Shipped kits: **${kitBySlug.size}**.`);
lines.push(`Hand-ported kits (\`scripts/data/kit-overrides.json\`): **${Object.keys(OVERRIDES).filter((k) => !k.startsWith('_')).length}** — ${Object.keys(OVERRIDES).filter((k) => !k.startsWith('_')).join(', ')}.`);
if (unmatched.length) lines.push(`\nUnmatched sheet creatures: ${unmatched.join(', ')}`);
if (unported.length) lines.push(`\nKits with no sheet row: ${unported.join(', ')}`);
lines.push('');
lines.push('## Modelled');
lines.push('');
lines.push('| mechanic | clauses |');
lines.push('| --- | --- |');
for (const [k, v] of [...rep.counts].filter(([k]) => k.startsWith('OK')).sort()) lines.push(`| ${k.slice(4)} | ${v} |`);
lines.push('');
lines.push('## Not modelled (recorded, never approximated)');
lines.push('');
lines.push('| category | clauses |');
lines.push('| --- | --- |');
for (const [k, v] of [...rep.counts].filter(([k]) => k.startsWith('---')).sort()) lines.push(`| ${k.slice(4)} | ${v} |`);
lines.push('');
lines.push(`Class-archetype damage-line fallbacks (slot had no parsable attack): **${rep.fallbacks.length}**`);
if (rep.fallbacks.length) lines.push(`\n${rep.fallbacks.join(', ')}`);
lines.push('');
const worst = [...rep.perKit].sort((a, b) => b[1] - a[1]).slice(0, 20);
if (worst.length) {
  lines.push('## Creatures with the most unparsed clauses');
  lines.push('');
  lines.push(worst.map(([id, n]) => `${id} (${n})`).join(', '));
  lines.push('');
}
const handGaps = Object.entries(OVERRIDES).filter(([k, o]) => !k.startsWith('_') && (o.notModelled ?? []).length > 0);
lines.push(`## Hand-ported, still not modelled (${handGaps.reduce((n, [, o]) => n + o.notModelled.length, 0)} items)`);
lines.push('');
for (const [k, o] of handGaps) for (const note of o.notModelled) lines.push(`- **${k}** — ${note}`);
lines.push('');
const plated = Object.keys(OVERRIDES._plates ?? {});
lines.push(`## Plate skills (R6a part 2, hand-ported in \`scripts/data/plate-skills.py\`): ${plated.length}`);
lines.push('');
lines.push('Source: `scripts/data/plate-skills-source.json` (hero_stone_skill_json, 228 skills / 76 Pokémon). Applied by');
lines.push('`applyPlateSkills` for tiers at or below the Pokémon\'s plate stage. An empty tier is listed in the readings.');
lines.push('');
lines.push(`Ported: ${plated.join(', ')}.`);
lines.push('');
for (const n of OVERRIDES._plateNotes ?? []) lines.push(`- ${n}`);
lines.push('');
const trinketed = Object.keys(OVERRIDES._trinkets ?? {});
lines.push(`## Trinket skills (R6b part 2, hand-ported in \`scripts/data/trinket-skills.py\`): ${trinketed.length}`);
lines.push('');
lines.push('Source: `scripts/data/trinket-skills-source.json` (hero_weapon_json skill_list, 371 texts / 76 holders). Applied by');
lines.push('`applyTrinketSkills`: only the highest tier (Lv 10 / 20 / 30 / 40) at or below the trinket level.');
lines.push('');
if (trinketed.length) lines.push(`Ported: ${trinketed.join(', ')}.`);
lines.push('');
for (const n of OVERRIDES._trinketNotes ?? []) lines.push(`- ${n}`);
lines.push('');
lines.push(`## Berry skills (R6d, hand-ported in \`scripts/data/berry-skills.py\`): ${(OVERRIDES._berries ?? []).length}`);
lines.push('');
lines.push('Source: the berries\' skills by star (dump `_berries`, in packages/content/equipment/berries.json); generated to');
lines.push('packages/content/equipment/berry-skills.json and applied by `applyBerrySkills` (one skill per carried berry, at its star).');
lines.push('');
for (const n of OVERRIDES._berryNotes ?? []) lines.push(`- ${n}`);
lines.push('');
lines.push(`## Unparsed clause patterns (${rep.residualMap.size} distinct, top 60)`);
lines.push('');
lines.push('| count | clause | example |');
lines.push('| --- | --- | --- |');
for (const [, e] of [...rep.residualMap].sort((a, b) => b[1].count - a[1].count).slice(0, 60)) {
  lines.push(`| ${e.count} | ${normKey(e.example).replace(/\|/g, '/')} | ${e.example.replace(/\|/g, '/').slice(0, 100)} |`);
}
lines.push('');
writeFileSync(REPORT, `${lines.join('\n')}\n`);
console.log(`kits written: ${kitBySlug.size}`);
console.log(`unparsed clause patterns: ${rep.residualMap.size}`);
console.log(`unmatched: ${unmatched.length}, unported: ${unported.length}, damage fallbacks: ${rep.fallbacks.length}`);
