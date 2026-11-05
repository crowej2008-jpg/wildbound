import {
  arrive,
  exploreAccess,
  floorPay,
  floorRule,
  fountain,
  healAll,
  hire,
  initialMisty,
  recordFight,
  replayTo,
  revive,
  rollMisty,
  stepBlock,
  tileOf,
  type AccountState,
  type MistyError,
  type MistyRules,
  type MistyState,
  type MistyTile,
  type Rewards,
  type WildInstance,
} from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView, type BuiltTeam } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { enemiesFor } from './pve/shared';
import { withBadgeBonus } from './victory-road';

/**
 * Misty Woods (M13.6). The engine owns the map, carry-over and tiles; this module builds the carried-HP team
 * (the `misty` squad minus the fallen, hired helpers in empty slots), fights, and pays. See
 * docs/design/misty-woods.md.
 */

export function mistyRules(config: GameConfig): MistyRules {
  return config.misty as unknown as MistyRules;
}

export function mistyGate(config: GameConfig, state: AccountState, now: number): boolean {
  const mode = config.explore.modes.find((m) => m.id === 'misty-woods');
  if (!mode) return false;
  return exploreAccess(mode.gates, {
    campaign: state.campaign,
    level: state.profile.level,
    serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
  }).unlocked;
}

/** The run, started on first use and reset every cycle. */
export function prepareMisty(config: GameConfig, state: AccountState, now: number): { state: AccountState; changed: boolean } {
  const rules = mistyRules(config);
  const current = state.misty ?? initialMisty(rules, now);
  const rolled = rollMisty(rules, current, now);
  if (rolled === state.misty) return { state, changed: false };
  return { state: { ...state, misty: rolled }, changed: true };
}

const ERROR_TEXT: Record<MistyError, string> = {
  node_missing: 'that tile does not exist',
  not_reachable: 'that tile is not next to you',
  chapter_locked: 'chapter 4 opens after story 20-10',
  no_team: 'every Pokémon in the team has fallen',
  not_hire: 'there is no one to hire here',
  no_fallen: 'that Pokémon has not fallen',
  bad_pick: 'that Pokémon is not on offer',
};

/** The fighters: the misty squad (not fallen) then helpers, up to six, with their unit ids. */
export function mistyTeam(state: AccountState, misty: MistyState): { wilds: WildInstance[]; ids: string[]; helpers: WildInstance[] } {
  const fallen = new Set(misty.fallen);
  const wilds = fielded(state, 'misty').filter((w) => !fallen.has(w.id));
  const helpers = misty.helpers
    .filter((h) => !fallen.has(h.id))
    .slice(0, Math.max(0, 6 - wilds.length))
    .map((h) => ({ id: h.id, speciesId: h.speciesId, level: h.level, stars: h.stars, xp: 0 }) as unknown as WildInstance);
  return { wilds, helpers, ids: [...wilds.map((w) => w.id), ...helpers.map((h) => h.id)] };
}

function mergeTeams(a: BuiltTeam, b: BuiltTeam): BuiltTeam {
  return { specs: [...a.specs, ...b.specs], meta: new Map([...a.meta, ...b.meta]), power: a.power + b.power };
}

export interface MistyStepResult {
  state: AccountState;
  tile: MistyTile;
  battle?: BattleView;
  win?: boolean;
  rewards: Rewards;
}

/** Step onto a reachable tile. Fights run with carried HP; other tiles resolve at once. */
export function stepMisty(config: GameConfig, state: AccountState, now: number, nodeId: number, seed?: number): Result<MistyStepResult> {
  if (!mistyGate(config, state, now)) return fail('resource_locked', 'Misty Woods opens after story 3-10');
  const rules = mistyRules(config);
  const prepared = prepareMisty(config, state, now).state;
  const misty = prepared.misty!;
  const block = stepBlock(rules, misty, nodeId);
  if (block) return fail('invalid_input', ERROR_TEXT[block]);
  const node = rules.nodes.find((n) => n.id === nodeId)!;
  if (node.chapter === 4 && !(prepared.campaign.stars[rules.chapter4Stage] ?? 0)) {
    return fail('resource_locked', ERROR_TEXT.chapter_locked);
  }
  const tile = tileOf(misty, node);

  if (tile === 'fight' || tile === 'boss') {
    const team = mistyTeam(prepared, misty);
    if (team.ids.length === 0) return fail('not_ready', ERROR_TEXT.no_team);
    const own = buildWildTeam(team.wilds, 'attackers', config, prepared, undefined, team.wilds.map((_, i) => i));
    const help = buildWildTeam(team.helpers, 'attackers', config, undefined, undefined, team.helpers.map((_, i) => team.wilds.length + i));
    const attackers = mergeTeams(own, help);
    const idBySpec = new Map<string, string>();
    for (const spec of attackers.specs) {
      const slot = Number(spec.id.split('-').pop());
      const id = team.ids[slot]!;
      idBySpec.set(`attackers:${spec.position}`, id);
      if (misty.hp[id] !== undefined) spec.startHpFraction = misty.hp[id];
      if (misty.rage[id] !== undefined) spec.startRage = misty.rage[id];
    }
    const levels = [...team.wilds, ...team.helpers].map((w) => w.level);
    const level = Math.max(1, Math.round(levels.reduce((s, l) => s + l, 0) / levels.length));
    const rule = floorRule(rules, node.chapter, node.floor);
    const k = (rule?.rate ?? 100) / 100;
    const enemies = enemiesFor(config, { ...rules.enemy, baseLevel: level }, 0).map((e) => ({ ...e, mult: { hp: k, atk: k, def: k } }));
    const battle = runTeams(attackers, buildEnemyTeam(enemies, config), {
      seed: seed ?? Math.floor(config.rng() * 0xffffffff),
      mode: 'misty',
      battleId: `m13:misty:${misty.cycle}:${node.id}`,
      strategies: { attackers: prepared.strategies.misty },
    });
    if (!battle) return fail('not_found', 'no Pokémon available for Misty Woods');
    const final = replayTo(battle.units, battle.events, battle.events.length);
    const results = final.units
      .filter((u) => u.key.startsWith('attackers:') && idBySpec.has(u.key))
      .map((u) => ({ id: idBySpec.get(u.key)!, hpFraction: u.maxHp > 0 ? u.hp / u.maxHp : 0, rage: u.rage, alive: u.hp > 0 }));
    let next = recordFight(misty, results);
    const win = battle.winner === 'attackers';
    let rewards: Rewards = {};
    if (win) {
      const paid = floorPay(rules, next, node);
      next = arrive(rules, paid.state, node);
      rewards = withBadgeBonus(config, prepared, { ...(paid.forestCoin ? { forestCoin: paid.forestCoin } : {}), ...(paid.gems ? { gems: paid.gems } : {}) }, 'mistyCoins', 'forestCoin');
    }
    return ok({ state: applyGrant(config, { ...prepared, misty: next }, rewards), tile, battle, win, rewards });
  }

  let next = arrive(rules, misty, node);
  if (tile === 'fountain') next = fountain(rules, next);
  if (tile === 'tombstone' && next.fallen.length > 0) {
    const revived = revive(rules, next, next.fallen[0]!);
    if (revived.ok) next = revived.state;
  }
  if (tile === 'hire') next = { ...next, hireOffer: hireOffer(config, prepared, rules, misty.cycle, node.id) };
  return ok({ state: { ...prepared, misty: next }, tile, rewards: {} });
}

/** Helpers on offer: Supreme / Mythic species the account does not own (deterministic per cycle and node). */
function hireOffer(config: GameConfig, state: AccountState, rules: MistyRules, cycle: number, nodeId: number): string[] {
  const owned = new Set(state.roster.map((w) => w.speciesId));
  const pool = [...config.species.values()].filter((s) => (s.tier === 'supreme' || s.tier === 'mythic') && !owned.has(s.id)).map((s) => s.id);
  const out: string[] = [];
  let x = (cycle * 31 + nodeId) >>> 0;
  while (out.length < rules.hireOffers && pool.length > 0) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    out.push(pool.splice(x % pool.length, 1)[0]!);
  }
  return out;
}

/** Hire a helper from the offer on the current tile: it joins at the team's average level and stars. */
export function hireMisty(config: GameConfig, state: AccountState, now: number, speciesId: string): Result<AccountState> {
  if (!mistyGate(config, state, now)) return fail('resource_locked', 'Misty Woods is not open yet');
  const prepared = prepareMisty(config, state, now).state;
  const team = fielded(prepared, 'misty');
  const level = team.length > 0 ? Math.round(team.reduce((s, w) => s + w.level, 0) / team.length) : 1;
  const stars = team.length > 0 ? Math.round(team.reduce((s, w) => s + w.stars, 0) / team.length) : 1;
  const hired = hire(prepared.misty!, speciesId, level, stars);
  if (!hired.ok) return fail('invalid_input', ERROR_TEXT[hired.error]);
  return ok({ ...prepared, misty: hired.state });
}

/** The Diamond shop on the current tile: heal everyone, or revive one fallen Pokémon. */
export function mistyShop(config: GameConfig, state: AccountState, now: number, kind: 'heal' | 'revive', unitId?: string): Result<AccountState> {
  if (!mistyGate(config, state, now)) return fail('resource_locked', 'Misty Woods is not open yet');
  const rules = mistyRules(config);
  const prepared = prepareMisty(config, state, now).state;
  const misty = prepared.misty!;
  const here = rules.nodes.find((n) => n.id === misty.at);
  if (!here || tileOf(misty, here) !== 'shop') return fail('invalid_input', 'there is no shop here');
  const price = kind === 'heal' ? rules.shop.healAll : rules.shop.revive;
  if (prepared.currencies.gems < price) return fail('insufficient_items', `not enough Diamonds (${price})`);
  let next: MistyState;
  if (kind === 'heal') next = healAll(misty);
  else {
    const revived = revive(rules, misty, unitId ?? misty.fallen[0] ?? '');
    if (!revived.ok) return fail('invalid_input', ERROR_TEXT[revived.error]);
    next = revived.state;
  }
  return ok({ ...prepared, misty: next, currencies: { ...prepared.currencies, gems: prepared.currencies.gems - price } });
}
