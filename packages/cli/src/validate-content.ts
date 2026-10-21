import { readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import {
  accountSchema,
  ACCOUNT,
  combatSettingsSchema,
  contentManifest,
  economySchema,
  FACTIONS,
  growthSchema,
  kitSchema,
  powerSchema,
  questSchema,
  speciesSchema,
  stageSchema,
  gachaSchema,
  shopSchema,
  pveSchema,
  PVE,
  pvpSchema,
  PVP,
  relicsSchema,
  platesSchema,
  trinketsSchema,
  runesSchema,
  charmsSchema,
  coresSchema,
  talentsSchema,
  equipmentTuningSchema,
  collectionTuningSchema,
  RELICS,
  PLATES,
  TRINKETS,
  RUNES,
  RUNE_SETS,
  CHARMS,
  CORE_SETS,
  TALENT_BLOCKS,
  TALENT_TREES,
  EQUIPMENT_TUNING,
  type KitJson,
  type QuestJson,
  type SpeciesJson,
  type StageJson,
  type ShopJson,
} from '@wildbound/content';
import { CURRENCY_IDS } from '@wildbound/engine';
import { findFiles, GuardViolation, scanBinaryMedia, scanForbidden } from './ipguard';

/**
 * Structural view of a Zod schema so the CLI never imports `zod` directly
 * (avoids a second copy of the library and its types).
 */
interface SafeParseError {
  issues: { path: (string | number)[]; message: string }[];
}
type AnySchema = {
  safeParse(input: unknown): { success: true; data: unknown } | { success: false; error: SafeParseError };
};

export interface ValidateReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checks: string[];
}

const PACKAGE_DIRS = ['engine', 'content', 'server', 'client', 'cli'];

/** Tuning files are identified by filename; each maps to exactly one schema. */
const TUNING_SCHEMAS: Record<string, AnySchema> = {
  'combat.json': combatSettingsSchema,
  'growth.json': growthSchema,
  'power.json': powerSchema,
  'account.json': accountSchema,
  'economy.json': economySchema,
  'gacha.json': gachaSchema as AnySchema,
  'equipment.json': equipmentTuningSchema,
  'collection.json': collectionTuningSchema,
  'pve.json': pveSchema as AnySchema,
  'pvp.json': pvpSchema as AnySchema,
};

/** M7 catalogue files are identified by filename; each maps to one schema. */
const EQUIPMENT_SCHEMAS: Record<string, AnySchema> = {
  'relics.json': relicsSchema,
  'plates.json': platesSchema,
  'trinkets.json': trinketsSchema,
  'runes.json': runesSchema,
  'charms.json': charmsSchema,
  'cores.json': coresSchema,
  'talents.json': talentsSchema,
};

/**
 * Structural checks that grow with content milestones. What ships today:
 *  - the content tree exists with the declared data dirs,
 *  - every .json under packages/content parses and has no duplicate ids,
 *  - species/kits parse against their schemas and cross-reference (same
 *    id/faction/class/tier),
 *  - tuning files validate against the schema named by their filename,
 *  - the IP guard passes (no franchise terms in content, no binary media under
 *    packages/),
 *  - no empty-string `id`/`name` fields in content JSON.
 */
export function validateContent(repoRoot: string): ValidateReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: string[] = [];

  const contentRoot = resolve(repoRoot, 'packages', 'content');
  const species = new Map<string, { file: string; data: SpeciesJson }>();
  const kits = new Map<string, { file: string; data: KitJson }>();
  const stages = new Map<string, { file: string; data: StageJson }>();
  const quests = new Map<string, { file: string; data: QuestJson }>();
  const shops = new Map<string, { file: string; data: ShopJson }>();

  for (const dir of contentManifest.dataDirs) {
    const dirPath = join(contentRoot, dir);
    if (!exists(dirPath)) {
      warnings.push(`content data dir "packages/content/${dir}" is not populated yet (lands in M2)`);
      continue;
    }
    const jsonFiles = findFiles(dirPath).filter((f) => extname(f) === '.json');
    for (const file of jsonFiles) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch (err) {
        errors.push(`${file}: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
        continue;
      }
      for (const violation of checkRecord(parsed)) {
        errors.push(`${file}: ${violation.detail}`);
      }

      if (dir === 'kits') {
        validateList(file, parsed, kitSchema, errors, checks, (data: KitJson) => {
          registerUnique(kits, file, data.id, data, errors);
        }, 'kit');
      } else if (dir === 'species') {
        validateList(file, parsed, speciesSchema, errors, checks, (data: SpeciesJson) => {
          registerUnique(species, file, data.id, data, errors);
        }, 'species');
      } else if (dir === 'stages') {
        validateList(file, parsed, stageSchema, errors, checks, (data: StageJson) => {
          registerUnique(stages, file, data.id, data, errors);
        }, 'stage');
      } else if (dir === 'quests') {
        validateList(file, parsed, questSchema, errors, checks, (data: QuestJson) => {
          registerUnique(quests, file, data.id, data, errors);
        }, 'quest');
      } else if (dir === 'shops') {
        validateList(file, parsed, shopSchema, errors, checks, (data: ShopJson) => {
          registerUnique(shops, file, data.id, data, errors);
        }, 'shop');
      } else if (dir === 'equipment') {
        const schema = EQUIPMENT_SCHEMAS[basename(file)];
        if (!schema) {
          errors.push(`${file}: unknown equipment file (expected one of ${Object.keys(EQUIPMENT_SCHEMAS).join(', ')})`);
          continue;
        }
        const r = schema.safeParse(parsed);
        if (!r.success) errors.push(`${file}: equipment schema — ${describeZod(r.error.issues)}`);
        else checks.push(`${file}: equipment validated against ${basename(file)} schema`);
      } else if (dir === 'tuning') {
        const schema = TUNING_SCHEMAS[basename(file)];
        if (!schema) {
          errors.push(`${file}: unknown tuning file (expected one of ${Object.keys(TUNING_SCHEMAS).join(', ')})`);
          continue;
        }
        const r = schema.safeParse(parsed);
        if (!r.success) errors.push(`${file}: tuning schema — ${describeZod(r.error.issues)}`);
        else checks.push(`${file}: tuning validated against ${basename(file)} schema`);
      }
    }
    checks.push(`parsed ${jsonFiles.length} JSON file(s) in packages/content/${dir}`);
  }

  crossReference(species, kits, errors, checks);
  checkSpeciesCoverage(species, errors, checks);
  crossReferenceStages(species, stages, errors, checks);
  if (stages.size > 0) checks.push(`campaign: ${stages.size} stage(s) validated`);
  if (quests.size > 0) checks.push(`quests: ${quests.size} daily quest(s) validated`);
  if (shops.size > 0) {
    checks.push(`shops: ${shops.size} shop(s) validated`);
    for (const { file, data } of shops.values()) {
      if (!CURRENCY_IDS.includes(data.currency as never)) {
        errors.push(`${file}: shop "${data.id}" currency "${data.currency}" is not a known currency`);
      }
    }
  }
  for (const id of ACCOUNT.startingRoster) {
    if (!species.has(id)) errors.push(`account.json: startingRoster species "${id}" has no species file`);
  }
  checks.push(`account: ${ACCOUNT.startingRoster.length} starting Wild(s) resolved`);

  if (RELICS.length > 0) {
    const relicIds = new Set(RELICS.map((r) => r.id));
    const runeIds = new Set(RUNES.map((r) => r.id));
    const runeSetIds = new Set(RUNE_SETS.map((s) => s.id));
    const charmIds = new Set(CHARMS.map((c) => c.id));
    const coreSetIds = new Set(CORE_SETS.map((s) => s.id));
    const blockIds = new Set(TALENT_BLOCKS.map((b) => b.id));
    for (const rune of RUNES) {
      if (!runeSetIds.has(rune.setId)) errors.push(`equipment: rune "${rune.id}" references unknown set "${rune.setId}"`);
    }
    for (const tree of TALENT_TREES) {
      for (const tier of tree.tiers) {
        for (const blockId of tier) {
          if (!blockIds.has(blockId)) errors.push(`equipment: tree "${tree.id}" references unknown block "${blockId}"`);
        }
      }
    }
    for (const r of EQUIPMENT_TUNING.starting.relics) {
      if (!relicIds.has(r.defId)) errors.push(`equipment: starting relic "${r.defId}" has no design`);
    }
    for (const faction of ['ember', 'tide', 'grove', 'volt', 'frost', 'shade']) {
      const count = PLATES.filter((p) => p.faction === faction).length;
      if (count !== 1) errors.push(`equipment: faction "${faction}" has ${count} plates (want 1)`);
    }
    const trinketSpecies = new Set<string>();
    for (const trinket of TRINKETS) {
      if (!species.has(trinket.speciesId)) {
        errors.push(`equipment: trinket "${trinket.id}" references unknown species "${trinket.speciesId}"`);
      }
      if (trinketSpecies.has(trinket.speciesId)) {
        errors.push(`equipment: species "${trinket.speciesId}" has more than one trinket`);
      }
      trinketSpecies.add(trinket.speciesId);
    }
    for (const speciesId of species.keys()) {
      if (!trinketSpecies.has(speciesId)) errors.push(`equipment: species "${speciesId}" has no trinket`);
    }
    for (const r of EQUIPMENT_TUNING.starting.runes) {
      if (!runeIds.has(r.defId)) errors.push(`equipment: starting rune "${r.defId}" has no design`);
    }
    for (const c of EQUIPMENT_TUNING.starting.cores) {
      if (!coreSetIds.has(c.setId)) errors.push(`equipment: starting core "${c.setId}" has no set`);
    }
    for (const set of CORE_SETS) {
      for (const pieces of [2, 4, 6]) {
        if (!set.bonuses.some((bonus) => bonus.pieces === pieces)) {
          errors.push(`equipment: soul-heart set "${set.id}" has no ${pieces}-piece bonus`);
        }
      }
    }
    for (const c of EQUIPMENT_TUNING.starting.charms) {
      if (!charmIds.has(c.defId)) errors.push(`equipment: starting charm "${c.defId}" has no design`);
    }
    for (const tier of ['common', 'basic', 'intermediate', 'greater']) {
      const count = CHARMS.filter((c) => c.tier === tier).length;
      if (count !== 4) errors.push(`equipment: Berry tier "${tier}" has ${count} designs (want 4)`);
    }
    for (const c of CHARMS) {
      if (c.tier === 'common' && c.maxStars !== 0) errors.push(`equipment: common Berry "${c.id}" must be fixed`);
      if (c.tier !== 'common' && c.maxStars <= 0) errors.push(`equipment: Berry "${c.id}" needs a star cap`);
    }
    checks.push(
      `equipment: ${RELICS.length} relic(s), ${PLATES.length} plate(s), ${TRINKETS.length} trinket(s), ${RUNES.length} rune(s), ${CHARMS.length} charm(s), ${CORE_SETS.length} core set(s), ${TALENT_TREES.length} talent tree(s) validated`,
    );
  }

  crossReferencePve(species, errors, checks);
  crossReferencePvp(species, stages, errors, checks);

  const contentViolations = scanForbidden(contentRoot, contentManifest.dataDirs);
  const mediaViolations = scanBinaryMedia(resolve(repoRoot, 'packages'), PACKAGE_DIRS);
  if (contentViolations.length > 0) {
    for (const v of contentViolations) errors.push(describe(v));
  } else {
    checks.push('IP guard: no franchise terms in content');
  }
  if (mediaViolations.length > 0) {
    for (const v of mediaViolations) errors.push(describe(v));
  } else {
    checks.push('IP guard: no binary media under packages/');
  }

  checks.push(`content schema version ${contentManifest.schemaVersion}`);
  return { ok: errors.length === 0, errors, warnings, checks };
}

function validateList<T>(
  file: string,
  parsed: unknown,
  schema: AnySchema,
  errors: string[],
  checks: string[],
  onValid: (data: T) => void,
  label: string,
): void {
  const raws = Array.isArray(parsed) ? parsed : [parsed];
  let valid = 0;
  raws.forEach((raw, index) => {
    const r = schema.safeParse(raw);
    if (!r.success) {
      errors.push(`${file}${Array.isArray(parsed) ? `[${index}]` : ''}: ${label} schema — ${describeZod(r.error.issues)}`);
      return;
    }
    valid += 1;
    onValid(r.data as T);
  });
  checks.push(`${file}: ${valid}/${raws.length} ${label}(s) validated against ${label} schema`);
}

function registerUnique<T>(
  map: Map<string, { file: string; data: T }>,
  file: string,
  id: string,
  data: T,
  errors: string[],
): void {
  const prev = map.get(id);
  if (prev) {
    errors.push(`${file}: duplicate id "${id}" (already defined in ${prev.file})`);
    return;
  }
  map.set(id, { file, data });
}

function crossReference(
  species: Map<string, { file: string; data: SpeciesJson }>,
  kits: Map<string, { file: string; data: KitJson }>,
  errors: string[],
  checks: string[],
): void {
  for (const [id, entry] of species) {
    const kit = kits.get(id);
    if (!kit) {
      errors.push(`${entry.file}: species "${id}" has no matching kit`);
      continue;
    }
    const s = entry.data;
    const k = kit.data;
    if (s.faction !== k.faction) errors.push(`${entry.file}: species "${id}" faction ${s.faction} != kit faction ${k.faction}`);
    if (s.class !== k.class) errors.push(`${entry.file}: species "${id}" class ${s.class} != kit class ${k.class}`);
    if (s.tier !== k.tier) errors.push(`${entry.file}: species "${id}" tier ${s.tier} != kit tier ${k.tier}`);
  }
  for (const [id, kit] of kits) {
    if (!species.has(id)) errors.push(`${kit.file}: kit "${id}" has no matching species`);
  }
  if (species.size > 0) checks.push(`cross-reference: ${species.size} species ↔ ${kits.size} kits`);
}

/** Every stage enemy must reference a real species; report chapters covered. */
function crossReferenceStages(
  species: Map<string, { file: string; data: SpeciesJson }>,
  stages: Map<string, { file: string; data: StageJson }>,
  errors: string[],
  checks: string[],
): void {
  if (stages.size === 0) return;
  for (const [id, entry] of stages) {
    entry.data.enemies.forEach((enemy, i) => {
      if (!species.has(enemy.speciesId)) {
        errors.push(`${entry.file}: stage "${id}" enemy[${i}] species "${enemy.speciesId}" has no species file`);
      }
    });
  }
  const chapters = new Set([...stages.values()].map((s) => s.data.chapter));
  checks.push(`campaign: stages reference ${species.size} species across ${chapters.size} chapter(s)`);
}

/**
 * Every PvE mode's enemy pool must reference real factions; the World Boss
 * rotation must reference real species; the daily dungeons must cover the seven
 * weekdays without duplication. (M8.)
 */
function crossReferencePve(
  species: Map<string, { file: string; data: SpeciesJson }>,
  errors: string[],
  checks: string[],
): void {
  const factions = new Set<string>([...species.values()].map((s) => s.data.faction));
  const pools: { label: string; factions: string[] }[] = [
    { label: 'tower', factions: PVE.tower.enemy.factions },
    { label: 'worldBoss', factions: PVE.worldBoss.enemy.factions },
    ...PVE.trials.map((t) => ({ label: `trial "${t.id}"`, factions: t.enemy.factions })),
    ...PVE.dungeons.map((d) => ({ label: `dungeon "${d.id}"`, factions: d.enemy.factions })),
  ];
  for (const pool of pools) {
    for (const faction of pool.factions) {
      if (!factions.has(faction)) {
        errors.push(`pve.json: ${pool.label} references unknown faction "${faction}"`);
      }
    }
  }
  for (const trial of PVE.trials) {
    if (trial.rule === 'factionLocked' && trial.faction && !factions.has(trial.faction)) {
      errors.push(`pve.json: trial "${trial.id}" locks an unknown faction "${trial.faction}"`);
    }
  }
  for (const boss of PVE.worldBoss.rotation) {
    if (!species.has(boss.speciesId)) {
      errors.push(`pve.json: world boss "${boss.name}" species "${boss.speciesId}" has no species file`);
    }
  }
  const seenWeekdays = new Map<number, string>();
  for (const dungeon of PVE.dungeons) {
    const prev = seenWeekdays.get(dungeon.weekday);
    if (prev) errors.push(`pve.json: dungeons "${prev}" and "${dungeon.id}" share weekday ${dungeon.weekday}`);
    seenWeekdays.set(dungeon.weekday, dungeon.id);
  }
  checks.push(
    `pve: ${PVE.trials.length} trial(s), ${PVE.dungeons.length} dungeon(s), ${PVE.worldBoss.rotation.length} boss day(s) validated`,
  );
}

/**
 * PvP tuning (M10): every Arena and Ranked weather faction must exist; the ranked
 * phases together must be able to roll all six factions as weather; the Arena
 * bands must be strictly ascending; and the chapter gates must be real chapters.
 */
function crossReferencePvp(
  species: Map<string, { file: string; data: SpeciesJson }>,
  stages: Map<string, { file: string; data: StageJson }>,
  errors: string[],
  checks: string[],
): void {
  const factions = new Set<string>([...species.values()].map((s) => s.data.faction));
  const pools: { label: string; factions: string[] }[] = [
    { label: 'arena opponent', factions: PVP.arena.opponent.factions },
    { label: 'ranked opponent', factions: PVP.ranked.opponent.factions },
    ...PVP.ranked.phases.map((p) => ({ label: `ranked phase "${p.id}"`, factions: p.weather })),
  ];
  for (const pool of pools) {
    for (const faction of pool.factions) {
      if (!factions.has(faction)) {
        errors.push(`pvp.json: ${pool.label} references unknown faction "${faction}"`);
      }
    }
  }
  const weatherSeen = new Set<string>();
  for (const phase of PVP.ranked.phases) for (const faction of phase.weather) weatherSeen.add(faction);
  for (const faction of FACTIONS) {
    if (!weatherSeen.has(faction)) errors.push(`pvp.json: no ranked phase can roll weather faction "${faction}"`);
  }
  let prev = -1;
  for (const band of PVP.arena.bands) {
    if (band.minCredits <= prev) errors.push('pvp.json: arena bands must be strictly ascending by minCredits');
    prev = band.minCredits;
  }
  const chapters = new Set([...stages.values()].map((s) => s.data.chapter));
  const gates: [string, number][] = [
    ['arenaChapter', PVP.arenaChapter],
    ['rankedChapter', PVP.rankedChapter],
  ];
  for (const [label, chapter] of gates) {
    if (chapters.size > 0 && !chapters.has(chapter)) {
      errors.push(`pvp.json: ${label} ${chapter} has no campaign chapter`);
    }
  }
  checks.push(
    `pvp: ${PVP.arena.bands.length} arena band(s), ${PVP.arena.chestTiers.length} chest tier(s), ${PVP.ranked.phases.length} ranked phase(s) validated`,
  );
}

function checkSpeciesCoverage(
  species: Map<string, { file: string; data: SpeciesJson }>,
  errors: string[],
  checks: string[],
): void {
  if (species.size === 0) return;
  const perFaction = new Map<string, number>();
  for (const { data } of species.values()) {
    perFaction.set(data.faction, (perFaction.get(data.faction) ?? 0) + 1);
  }
  // The owner's imported roster is no longer a balanced 6 per faction, so the
  // rule is now "every faction is represented" rather than "exactly six".
  for (const faction of FACTIONS) {
    if (!perFaction.has(faction)) errors.push(`species: faction "${faction}" has no species`);
  }
  checks.push(`species coverage: ${perFaction.size} faction(s), ${species.size} total`);
}

function exists(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function checkRecord(value: unknown): GuardViolation[] {
  if (Array.isArray(value)) return value.flatMap((v) => checkRecord(v));
  if (value === null || typeof value !== 'object') return [];
  const out: GuardViolation[] = [];
  for (const entry of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry[1] === 'object' && entry[1] !== null) {
      out.push(...checkRecord(entry[1]));
      continue;
    }
    const key = entry[0];
    if ((key === 'id' || key === 'name') && typeof entry[1] === 'string' && entry[1].trim() === '') {
      out.push({ file: '', detail: `empty-string "${key}" field` });
    }
  }
  return out;
}

function describe(v: GuardViolation): string {
  return `${v.file}: ${v.detail}`;
}

function describeZod(issues: { path: (string | number)[]; message: string }[]): string {
  return issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}
