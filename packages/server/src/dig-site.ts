import {
  digItemRule,
  exploreAccess,
  freedItems,
  initialDigSite,
  leaveWall,
  mulberry32,
  newWall,
  strike,
  type AccountState,
  type CoreInstance,
  type DigRules,
  type DigSiteState,
  type DigTool,
  type StatLine,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { fail, ok, type Result } from './index';

/**
 * Dig Site (M13.9): the owner's replacement for the Ultra Wormhole (2026-11-04). Free, unlimited walls (the main
 * series' rule); soul hearts are the main find, with Soul-heart EXP stones, fossils and treasures. Fossils cure
 * in a timed, Gold-priced lab; cured fossils and treasures go on display in the museum for account-wide stats,
 * with a bonus per completed group. See docs/design/dig-site.md.
 */

export function digRules(config: GameConfig): DigRules {
  return config.digSite as unknown as DigRules;
}

export function digGate(config: GameConfig, state: AccountState, now: number): boolean {
  const mode = config.explore.modes.find((m) => m.id === 'dig-site');
  if (!mode) return false;
  return exploreAccess(mode.gates, {
    campaign: state.campaign,
    level: state.profile.level,
    serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
  }).unlocked;
}

const LOCKED = 'the Dig Site opens after story 10-10 and trainer level 50';

function siteOf(config: GameConfig, state: AccountState): DigSiteState {
  return state.digSite ?? initialDigSite(config.digSite.labSlots);
}

function withSite(state: AccountState, site: DigSiteState): AccountState {
  return { ...state, digSite: site };
}

export interface DigFind {
  id: string;
  name: string;
  kind: string;
}

/** Pay out what a finished wall freed: soul hearts (random set and socket), EXP, raw fossils, treasures. */
function payWall(config: GameConfig, state: AccountState, site: DigSiteState): { state: AccountState; site: DigSiteState; finds: DigFind[] } {
  const rules = digRules(config);
  const wall = site.wall!;
  const rng = mulberry32((wall.seed ^ 0x50e1) >>> 0);
  let next = state;
  let equipment = state.equipment;
  const fossils = { ...site.fossils };
  const storage = { ...site.storage };
  let exp = 0;
  const finds: DigFind[] = [];
  for (const item of freedItems(wall)) {
    const rule = digItemRule(rules, item.id);
    if (!rule) continue;
    finds.push({ id: rule.id, name: rule.name, kind: rule.kind });
    if (rule.kind === 'soulHeart') {
      const sets = config.equipment.coreSets;
      const set = sets[Math.floor(rng() * sets.length)]!;
      const core: CoreInstance = {
        id: `co${equipment.nextSeq}`,
        setId: set.id,
        socket: Math.floor(rng() * config.equipment.tuning.cores.sockets),
        quality: rule.quality ?? 'blue',
        stars: 0,
      };
      equipment = { ...equipment, cores: [...equipment.cores, core], nextSeq: equipment.nextSeq + 1 };
    } else if (rule.kind === 'exp') exp += rule.exp ?? 0;
    else if (rule.kind === 'fossil') fossils[rule.id] = (fossils[rule.id] ?? 0) + 1;
    else storage[rule.id] = (storage[rule.id] ?? 0) + 1;
  }
  next = { ...next, equipment, currencies: { ...next.currencies, soulHeartExp: (next.currencies.soulHeartExp ?? 0) + exp } };
  return { state: next, site: { ...site, fossils, storage }, finds };
}

export interface DigResult {
  state: AccountState;
  /** Items paid when this action ended the wall. */
  finds: DigFind[];
}

/** Start a new wall (free). An unfinished wall is left first, keeping what it freed. */
export function startWall(config: GameConfig, state: AccountState, now: number): Result<DigResult> {
  if (!digGate(config, state, now)) return fail('resource_locked', LOCKED);
  let site = siteOf(config, state);
  let next = state;
  let finds: DigFind[] = [];
  if (site.wall && !site.wall.over) {
    site = { ...site, wall: leaveWall(site.wall) };
    const paid = payWall(config, next, site);
    next = paid.state;
    site = paid.site;
    finds = paid.finds;
  }
  const seed = (Math.imul(site.walls + 1, 2654435761) ^ (now & 0xffffffff)) >>> 0;
  site = { ...site, walls: site.walls + 1, wall: newWall(digRules(config), seed) };
  return ok({ state: withSite(next, site), finds });
}

/** Strike the wall with the pick or the hammer at (x, y). */
export function strikeWall(config: GameConfig, state: AccountState, now: number, tool: DigTool, x: number, y: number): Result<DigResult> {
  if (!digGate(config, state, now)) return fail('resource_locked', LOCKED);
  const site = siteOf(config, state);
  if (!site.wall || site.wall.over) return fail('not_ready', 'start a new wall first');
  if (tool !== 'pick' && tool !== 'hammer') return fail('invalid_input', 'use the pick or the hammer');
  const wall = strike(digRules(config), site.wall, tool, x, y);
  const struck = { ...site, wall };
  if (!wall.over) return ok({ state: withSite(state, struck), finds: [] });
  const paid = payWall(config, state, struck);
  return ok({ state: withSite(paid.state, paid.site), finds: paid.finds });
}

/** Stop digging the current wall and keep what is free. */
export function leaveDigWall(config: GameConfig, state: AccountState, now: number): Result<DigResult> {
  if (!digGate(config, state, now)) return fail('resource_locked', LOCKED);
  const site = siteOf(config, state);
  if (!site.wall || site.wall.over) return fail('not_ready', 'no wall in progress');
  const paid = payWall(config, state, { ...site, wall: leaveWall(site.wall) });
  return ok({ state: withSite(paid.state, paid.site), finds: paid.finds });
}

/** Put a raw fossil in a free lab slot: it cures over its hours for its Gold. */
export function cureFossil(config: GameConfig, state: AccountState, now: number, fossil: string): Result<AccountState> {
  if (!digGate(config, state, now)) return fail('resource_locked', LOCKED);
  const site = siteOf(config, state);
  const rule = config.digSite.cure.find((c) => c.fossil === fossil);
  if (!rule) return fail('invalid_input', 'that is not a fossil');
  if ((site.fossils[fossil] ?? 0) < 1) return fail('insufficient_items', 'no such fossil to cure');
  const slot = site.lab.findIndex((s) => s === null);
  if (slot < 0) return fail('not_ready', 'every lab slot is busy');
  if (state.currencies.gold < rule.gold) return fail('insufficient_items', `curing costs ${rule.gold.toLocaleString()} Gold`);
  const lab = site.lab.map((s, i) => (i === slot ? { fossil, readyAt: now + rule.hours * 3_600_000 } : s));
  const fossils = { ...site.fossils, [fossil]: site.fossils[fossil]! - 1 };
  return ok(withSite({ ...state, currencies: { ...state.currencies, gold: state.currencies.gold - rule.gold } }, { ...site, lab, fossils }));
}

/** Take every finished fossil out of the lab into storage. */
export function collectCured(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; cured: string[] }> {
  if (!digGate(config, state, now)) return fail('resource_locked', LOCKED);
  const site = siteOf(config, state);
  const storage = { ...site.storage };
  const cured: string[] = [];
  const lab = site.lab.map((s) => {
    if (!s || s.readyAt > now) return s;
    storage[s.fossil] = (storage[s.fossil] ?? 0) + 1;
    cured.push(s.fossil);
    return null;
  });
  if (cured.length === 0) return fail('not_ready', 'nothing has finished curing');
  return ok({ state: withSite(state, { ...site, lab, storage }), cured });
}

/** Display a stored piece in the museum (one of each). */
export function displayPiece(config: GameConfig, state: AccountState, now: number, piece: string): Result<AccountState> {
  if (!digGate(config, state, now)) return fail('resource_locked', LOCKED);
  const site = siteOf(config, state);
  if (!config.digSite.pieces.some((p) => p.id === piece)) return fail('invalid_input', 'that cannot go in the museum');
  if (site.museum.includes(piece)) return fail('invalid_input', 'that piece is already on display');
  if ((site.storage[piece] ?? 0) < 1) return fail('insufficient_items', 'you have none of that piece');
  return ok(withSite(state, { ...site, museum: [...site.museum, piece], storage: { ...site.storage, [piece]: site.storage[piece]! - 1 } }));
}

/** Turn every spare (stored) piece into Soul-heart EXP. */
export function donateSpares(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; exp: number }> {
  if (!digGate(config, state, now)) return fail('resource_locked', LOCKED);
  const site = siteOf(config, state);
  let exp = 0;
  const storage: Record<string, number> = {};
  for (const [id, n] of Object.entries(site.storage)) {
    const keep = site.museum.includes(id) ? 0 : Math.min(1, n);
    const spare = n - keep;
    if (keep) storage[id] = keep;
    exp += spare * (id.startsWith('fossil-') ? config.digSite.duplicateExp.fossil : config.digSite.duplicateExp.treasure);
  }
  if (exp === 0) return fail('not_ready', 'no spare pieces');
  return ok({
    state: withSite({ ...state, currencies: { ...state.currencies, soulHeartExp: (state.currencies.soulHeartExp ?? 0) + exp } }, { ...site, storage }),
    exp,
  });
}

const flat = (field: string, value: number): StatLine => ({ kind: 'core', field, base: value, perLevel: 0 });
const pct = (field: string, value: number): StatLine => ({ kind: 'percent', field, base: value, perLevel: 0 });

/** The museum's account-wide lines: each displayed piece, plus each completed group's percent bonus. */
export function museumLines(config: GameConfig, state: AccountState): StatLine[] {
  const shown = new Set(state.digSite?.museum ?? []);
  if (shown.size === 0) return [];
  const lines: StatLine[] = [];
  for (const p of config.digSite.pieces) {
    if (!shown.has(p.id)) continue;
    lines.push(flat('hp', p.hp), flat('pAtk', p.atk), flat('sAtk', p.atk));
  }
  for (const g of config.digSite.groups) {
    const members = config.digSite.pieces.filter((p) => p.group === g.id);
    if (members.length > 0 && members.every((p) => shown.has(p.id))) lines.push(pct('hpPct', g.pct), pct('pAtkPct', g.pct), pct('sAtkPct', g.pct));
  }
  return lines;
}
