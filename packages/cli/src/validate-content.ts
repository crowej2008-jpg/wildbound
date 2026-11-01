import { readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import {
  accountSchema,
  ACCOUNT,
  CAMPAIGN,
  campaignSchema,
  combatSettingsSchema,
  EXPLORE,
  exploreSchema,
  PET_HOME,
  petHomeSchema,
  SKY_PILLAR,
  skyPillarSchema,
  GYMS,
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
  heldItemsSchema,
  platesSchema,
  trinketsSchema,
  TITLES,
  TITLE_SLOTS,
  orbsSchema,
  charmsSchema,
  coresSchema,
  equipmentTuningSchema,
  collectionTuningSchema,
  COLLECTION_TUNING,
  RELICS,
  PLATES,
  TRINKETS,
  ORBS,
  CHARMS,
  CORE_SETS,
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
  'campaign.json': campaignSchema,
  'explore.json': exploreSchema,
  'pet-home.json': petHomeSchema,
  'sky-pillar.json': skyPillarSchema,
  'economy.json': economySchema,
  'gacha.json': gachaSchema as AnySchema,
  'equipment.json': equipmentTuningSchema,
  'collection.json': collectionTuningSchema,
  'pve.json': pveSchema as AnySchema,
  'pvp.json': pvpSchema as AnySchema,
};

/** M7 catalogue files are identified by filename; each maps to one schema. */
const EQUIPMENT_SCHEMAS: Record<string, AnySchema> = {
  'held-items.json': heldItemsSchema,
  'plates.json': platesSchema,
  'trinkets.json': trinketsSchema,
  'orbs.json': orbsSchema,
  'charms.json': charmsSchema,
  'cores.json': coresSchema,
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
  crossReferenceCampaign(species, stages, errors, checks);
  crossReferenceExplore(stages, errors, checks);
  crossReferencePetHome(errors, checks);
  crossReferenceSkyPillar(species, errors, checks);
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
    const orbKinds = new Set(ORBS.kinds.map((k) => k.id));
    const charmIds = new Set(CHARMS.map((c) => c.id));
    const coreSetIds = new Set(CORE_SETS.map((s) => s.id));
    for (const set of ORBS.sets) {
      for (const kind of set.kinds) if (!orbKinds.has(kind)) errors.push(`equipment: orb set "${set.id}" names unknown kind "${kind}"`);
    }
    for (const r of EQUIPMENT_TUNING.starting.relics) {
      if (!relicIds.has(r.defId)) errors.push(`equipment: starting relic "${r.defId}" has no design`);
    }
    const plateIds = new Set(PLATES.plates.map((p) => p.id));
    for (const [id, runs] of Object.entries(PLATES.species)) {
      if (!species.has(id)) errors.push(`equipment: plate map names unknown species "${id}"`);
      for (const [, plate] of runs) if (!plateIds.has(plate)) errors.push(`equipment: ${id} has unknown plate ${plate}`);
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
    const vipTiers = COLLECTION_TUNING.vip.tiers;
    if (vipTiers[0]?.xp !== 0 || vipTiers[0]?.tier !== 0) {
      errors.push('collection: VIP tiers must start at tier 0 with 0 XP');
    }
    for (let index = 1; index < vipTiers.length; index += 1) {
      const previous = vipTiers[index - 1]!;
      const tier = vipTiers[index]!;
      if (tier.tier !== previous.tier + 1) errors.push(`collection: VIP tier ${tier.tier} is out of order`);
      if (tier.xp <= previous.xp) errors.push(`collection: VIP tier ${tier.tier} XP must increase`);
    }
    const titleIds = new Set<string>();
    const titleSlots = new Set<string>(TITLE_SLOTS);
    for (const title of TITLES) {
      if (titleIds.has(title.id)) errors.push(`titles: duplicate id "${title.id}"`);
      titleIds.add(title.id);
      if (!titleSlots.has(title.slot)) errors.push(`titles: "${title.id}" has unknown slot "${title.slot}"`);
      if (title.source === 'event' && title.stages.length !== 15) {
        errors.push(`titles: event title "${title.id}" must have 15 stages`);
      }
      if (title.stages.some((stage) => stage.cost < 0)) {
        errors.push(`titles: "${title.id}" has a negative stage cost`);
      }
    }
    const permanentTitles = TITLES.filter((title) => title.durationDays === null).length;
    const weekTitles = TITLES.filter((title) => title.durationDays === 7).length;
    const fortnightTitles = TITLES.filter((title) => title.durationDays === 14).length;
    if (TITLES.length !== 102 || permanentTitles !== 85 || weekTitles !== 15 || fortnightTitles !== 2) {
      errors.push(
        `titles: catalogue is ${TITLES.length} (${permanentTitles} permanent / ${weekTitles} 7-day / ${fortnightTitles} 14-day), want 102 (85 / 15 / 2)`,
      );
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
      `equipment: ${RELICS.length} held item(s), ${PLATES.plates.length} plate(s), ${TRINKETS.length} trinket(s), ${ORBS.kinds.length} orb kind(s), ${ORBS.sets.length} orb set(s), ${CHARMS.length} charm(s), ${CORE_SETS.length} core set(s) validated`,
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
 * M13.0a: 182 sequential chapters, 60 gyms on every third chapter, one gate per
 * gym, and every gym enemy resolves to a species.
 */
function crossReferenceCampaign(
  species: Map<string, { file: string; data: SpeciesJson }>,
  stages: Map<string, { file: string; data: StageJson }>,
  errors: string[],
  checks: string[],
): void {
  const chapterNumbers = new Set(CAMPAIGN.chapters.map((chapter) => chapter.number));
  if (chapterNumbers.size !== 182) errors.push('campaign.json: chapter numbers must be unique (expected 182)');
  for (let number = 1; number <= 182; number += 1) {
    if (!chapterNumbers.has(number)) errors.push(`campaign.json: chapter ${number} is missing`);
  }

  const gymIds = new Set<string>();
  for (const gym of GYMS) {
    if (gymIds.has(gym.id)) errors.push(`campaign.json: duplicate gym id "${gym.id}"`);
    gymIds.add(gym.id);
    if (gym.index < 1 || gym.index > 60) errors.push(`campaign.json: gym "${gym.id}" index out of range`);
    if (gym.chapter !== gym.index * 3) errors.push(`campaign.json: gym "${gym.id}" chapter is not index x 3`);
    if (!chapterNumbers.has(gym.chapter)) errors.push(`campaign.json: gym "${gym.id}" chapter ${gym.chapter} is missing`);
    gym.enemies.forEach((enemy, i) => {
      if (!species.has(enemy.speciesId)) {
        errors.push(`campaign.json: gym "${gym.id}" enemy[${i}] species "${enemy.speciesId}" has no species file`);
      }
    });
    const gateStage = stages.get(`c${gym.chapter}-1`);
    if (!gateStage) errors.push(`campaign.json: gym "${gym.id}" has no chapter gate c${gym.chapter}-1`);
    else if (gateStage.data.gate?.gymId !== gym.id) {
      errors.push(`campaign.json: stage c${gym.chapter}-1 must gate on "${gym.id}"`);
    }
  }

  let gates = 0;
  for (const [id, entry] of stages) {
    if (!entry.data.gate) continue;
    gates += 1;
    if (!gymIds.has(entry.data.gate.gymId)) {
      errors.push(`${entry.file}: stage "${id}" gates on unknown gym "${entry.data.gate.gymId}"`);
    }
  }
  if (gates !== 60) errors.push(`campaign: expected 60 story gates, found ${gates}`);
  checks.push(`campaign: ${chapterNumbers.size} chapters, ${GYMS.length} gyms and ${gates} gate(s) validated`);
}

/**
 * Every PvE mode's enemy pool must reference real factions; the World Boss
 * rotation must reference real species; the daily dungeons must cover the seven
 * weekdays without duplication. (M8.)
 */
/**
 * M13.0b: the Explore hub has eight unique modes and every campaign gate names
 * a real stage. The engine evaluates the gates at runtime.
 */
function crossReferenceExplore(
  stages: Map<string, { file: string; data: StageJson }>,
  errors: string[],
  checks: string[],
): void {
  const ids = new Set<string>();
  for (const mode of EXPLORE.modes) {
    if (ids.has(mode.id)) errors.push(`explore.json: duplicate mode id "${mode.id}"`);
    ids.add(mode.id);
    for (const gate of mode.gates) {
      if (gate.kind === 'campaign' && !stages.has(`c${gate.chapter}-${gate.stage}`)) {
        errors.push(
          `explore.json: mode "${mode.id}" gates on missing stage c${gate.chapter}-${gate.stage}`,
        );
      }
    }
  }
  checks.push(`explore: ${EXPLORE.modes.length} mode shells and their gates validated`);
}

/**
 * M13.1: Pet Home has one rule per Home level, a 5x5 position set, one income
 * row per merge level, and 84 + 48 original shop rows in the source's shape.
 */
function crossReferencePetHome(errors: string[], checks: string[]): void {
  const levels = PET_HOME.levels;
  const tiles = PET_HOME.tiles;
  const positions = new Set<string>();
  const tileIds = new Set<number>();
  for (const tile of tiles) {
    const key = `${tile.row}:${tile.col}`;
    if (positions.has(key)) errors.push(`pet-home.json: duplicate tile position ${key}`);
    positions.add(key);
    if (tileIds.has(tile.id)) errors.push(`pet-home.json: duplicate tile id ${tile.id}`);
    tileIds.add(tile.id);
    if (tile.row < 0 || tile.row > 4 || tile.col < 0 || tile.col > 4) {
      errors.push(`pet-home.json: tile ${tile.id} is outside the 5x5 board`);
    }
  }
  for (let level = 0; level < levels.length; level += 1) {
    const row = levels[level]!;
    if (row.level !== level) errors.push(`pet-home.json: level row ${level} has level ${row.level}`);
    const revealed = tiles.filter((tile) => tile.unlockLevel <= row.level).length;
    if (revealed !== row.tiles) {
      errors.push(`pet-home.json: level ${row.level} says ${row.tiles} tiles, layout reveals ${revealed}`);
    }
    if (level > 0 && row.xp <= levels[level - 1]!.xp) {
      errors.push(`pet-home.json: level ${row.level} XP must increase`);
    }
    if (row.mergeCap < 1 || row.mergeCap > 16) {
      errors.push(`pet-home.json: level ${row.level} merge cap is out of range`);
    }
  }
  for (let level = 1; level <= 16; level += 1) {
    if (!PET_HOME.income.some((row) => row.level === level)) {
      errors.push(`pet-home.json: income is missing merge level ${level}`);
    }
  }
  const shops = [PET_HOME.shops.home, PET_HOME.shops.deluxe];
  for (const shop of shops) {
    const offers = shop.bands.flatMap((band) => band.offers);
    const ids = new Set(offers.map((offer) => offer.id));
    if (ids.size !== offers.length) errors.push(`pet-home.json: ${shop.id} shop has duplicate offer ids`);
    if (shop.offersPerPage < 1) errors.push(`pet-home.json: ${shop.id} shop has no offers per page`);
    for (const offer of offers) {
      if (offer.price <= 0) errors.push(`pet-home.json: ${shop.id} offer "${offer.id}" has no price`);
    }
  }
  const homeRows = PET_HOME.shops.home.bands.reduce((sum, band) => sum + band.offers.length, 0);
  const deluxeRows = PET_HOME.shops.deluxe.bands.reduce((sum, band) => sum + band.offers.length, 0);
  if (homeRows !== 84) errors.push(`pet-home.json: Home Exchange has ${homeRows} rows (want 84)`);
  if (deluxeRows !== 48) errors.push(`pet-home.json: Orb Atelier has ${deluxeRows} rows (want 48)`);
  checks.push(
    `pet-home: ${levels.length} Home levels, ${tiles.length} tiles, ${homeRows}+${deluxeRows} shop rows validated`,
  );
}

/**
 * Sky Pillar tuning (M13.2): 180 floors x 10 stages across six 30-floor wings.
 * Every enemy faction must resolve to a real species, floor gates must ascend,
 * and the 10/20/30-star chests must exist exactly once per floor.
 */
function crossReferenceSkyPillar(
  species: Map<string, { file: string; data: SpeciesJson }>,
  errors: string[],
  checks: string[],
): void {
  const factions = new Set<string>([...species.values()].map((s) => s.data.faction));
  const { floors, wings } = SKY_PILLAR;
  if (floors.length !== 180) errors.push(`sky-pillar.json: ${floors.length} floors (want 180)`);
  if (wings.length !== 6) errors.push(`sky-pillar.json: ${wings.length} wings (want 6)`);
  const wingNames = new Set<string>();
  for (const wing of wings) {
    if (wingNames.has(wing.name)) errors.push(`sky-pillar.json: duplicate wing name "${wing.name}"`);
    wingNames.add(wing.name);
  }
  let previousLevel = 0;
  let previousFloor = 0;
  let stages = 0;
  for (const floor of floors) {
    if (floor.floor !== previousFloor + 1) {
      errors.push(`sky-pillar.json: floor ${floor.floor} is out of order`);
    }
    previousFloor = floor.floor;
    const expectedWing = Math.floor((floor.floor - 1) / 30) + 1;
    if (floor.wing !== expectedWing) {
      errors.push(`sky-pillar.json: floor ${floor.floor} is in wing ${floor.wing} (want ${expectedWing})`);
    }
    if (floor.playerLevel < previousLevel) {
      errors.push(`sky-pillar.json: floor ${floor.floor} lowers the player-level gate`);
    }
    previousLevel = floor.playerLevel;
    if (floor.stages.length !== 10) {
      errors.push(`sky-pillar.json: floor ${floor.floor} has ${floor.stages.length} stages (want 10)`);
    }
    if (floor.chests.map((chest) => chest.stars).join(',') !== '10,20,30') {
      errors.push(`sky-pillar.json: floor ${floor.floor} chest stars are not 10/20/30`);
    }
    const seenStages = new Set<number>();
    for (const stage of floor.stages) {
      stages += 1;
      if (stage.stage < 1 || stage.stage > 10 || seenStages.has(stage.stage)) {
        errors.push(`sky-pillar.json: floor ${floor.floor} repeats or skips stage ${stage.stage}`);
      }
      seenStages.add(stage.stage);
      if (stage.conditions.length !== 2) {
        errors.push(`sky-pillar.json: floor ${floor.floor} stage ${stage.stage} needs 2 star conditions`);
      }
      const pass = stage.pass.potentialShard ?? 0;
      const sweep = stage.sweep.potentialShard ?? 0;
      if (pass <= 0) {
        errors.push(`sky-pillar.json: floor ${floor.floor} stage ${stage.stage} pays no Potential Shard`);
      }
      if (sweep !== Math.floor(pass / 2)) {
        errors.push(`sky-pillar.json: floor ${floor.floor} stage ${stage.stage} sweep is not half the pass`);
      }
    }
    for (const faction of floor.enemy.factions) {
      if (!factions.has(faction)) {
        errors.push(`sky-pillar.json: floor ${floor.floor} references unknown faction "${faction}"`);
      }
    }
  }
  checks.push(`sky-pillar: ${floors.length} floors, ${stages} stages, ${wings.length} wings validated`);
}

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
