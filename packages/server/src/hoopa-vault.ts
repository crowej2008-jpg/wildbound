import {
  dayKey,
  exploreAccess,
  exitRun,
  floorOpen,
  keysClaimable,
  maxMultiplier,
  routeRoundCap,
  settleGuardian,
  settleRoute,
  startRun,
  type AccountState,
  type BagItem,
  type BagOrb,
  type HeldNamesByQuality,
  type HeldQuality,
  type HoopaCard,
  type HoopaError,
  type HoopaRun,
  type HoopaVaultRules,
  type Rewards,
} from '@wildbound/engine';
import { modeBattle, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { enemiesFor } from './pve/shared';
import { grantRelic } from './equipment';
import { grantOrb } from './orbs';

/**
 * Hoopa's Vault (M13.3). The engine owns the run rules; this module binds them to the gate, keys, battles and
 * account rewards. See docs/design/hoopa-vault.md.
 */

export function vaultRules(config: GameConfig): HoopaVaultRules {
  return config.hoopaVault as unknown as HoopaVaultRules;
}

/** Held-item def ids by quality: the Vault draws a quality, then any name of it at equal odds (source). */
export function heldNames(config: GameConfig): HeldNamesByQuality {
  const out: HeldNamesByQuality = {};
  for (const def of config.equipment.relics) {
    const q = def.tier as HeldQuality;
    (out[q] ??= []).push(def.id);
  }
  return out;
}

/** Turn the kept bag's held items and orbs into real instances; their lines roll now (as in the source). */
export function grantBag(config: GameConfig, state: AccountState, items: BagItem[], orbs: BagOrb[]): AccountState {
  let next = state;
  for (const item of items) {
    const granted = grantRelic(config, next, item.defId, config.rng);
    if (granted.ok) next = granted.value;
  }
  const kinds = config.equipment.orbs.kinds;
  for (const orb of orbs) {
    const kind = kinds[Math.floor(config.rng() * kinds.length)]!.id;
    const granted = grantOrb(config, next, kind, orb.colour, config.rng, orb.level);
    if (granted.ok) next = granted.value;
  }
  return next;
}

export function hoopaVaultGate(config: GameConfig, state: AccountState, now: number): boolean {
  const mode = config.explore.modes.find((m) => m.id === 'hoopa-vault');
  if (!mode) return false;
  return exploreAccess(mode.gates, {
    campaign: state.campaign,
    level: state.profile.level,
    serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
  }).unlocked;
}

const ERROR_TEXT: Record<HoopaError, string> = {
  run_active: 'a run is already in progress',
  no_run: 'no run in progress',
  floor_locked: 'clear the floor below first',
  multiplier_locked: 'that multiplier is not open yet',
  bad_card: 'that route is not on offer',
  at_guardian: 'the Exit Guardian is waiting',
  not_at_guardian: 'reach the exit first',
};

function locked(config: GameConfig, state: AccountState, now: number): Result<never> | null {
  return hoopaVaultGate(config, state, now) ? null : fail('resource_locked', "Hoopa's Vault opens on server day 15");
}

/** Claim today's free Vault Secret Keys. */
export function claimVaultKeys(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; keys: number }> {
  const block = locked(config, state, now);
  if (block) return block;
  const day = dayKey(now);
  if (!keysClaimable(state.hoopaVault, day)) return fail('daily_limit', "today's keys were already claimed");
  const keys = vaultRules(config).freeKeysPerDay;
  const next = applyGrant(config, { ...state, hoopaVault: { ...state.hoopaVault, keyDay: day } }, { vaultKey: keys });
  return ok({ state: next, keys });
}

/** Start a run on a floor, reserving `multiplier` keys (refunded on a loss, a catch or an exit). */
export function startVaultRun(
  config: GameConfig,
  state: AccountState,
  now: number,
  floor: number,
  multiplier: number,
  seed?: number,
): Result<AccountState> {
  const block = locked(config, state, now);
  if (block) return block;
  const keys = state.currencies.vaultKey ?? 0;
  if (keys < multiplier) return fail('insufficient_items', `not enough Vault Secret Keys (${multiplier} needed)`);
  const started = startRun(vaultRules(config), state.hoopaVault, floor, multiplier, seed ?? Math.floor(config.rng() * 0xffffffff));
  if (!started.ok) return fail(started.error === 'run_active' ? 'not_ready' : 'stage_locked', ERROR_TEXT[started.error]);
  return ok({
    ...state,
    currencies: { ...state.currencies, vaultKey: keys - multiplier },
    hoopaVault: started.state,
  });
}

function refund(state: AccountState, run: HoopaRun): AccountState {
  return { ...state, currencies: { ...state.currencies, vaultKey: (state.currencies.vaultKey ?? 0) + run.multiplier } };
}

export interface VaultRouteResult {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  /** 'caught' / 'lost' end the run (keys refunded, bag lost). */
  ended: 'caught' | 'lost' | null;
  /** Shards banked by this win. */
  drops: Rewards;
  /** Held items and orbs banked by this win (kept only if the Guardian falls). */
  items: BagItem[];
  orbs: BagOrb[];
  card: HoopaCard;
}

/** Fight the route battle behind one of the offered cards. */
export function fightVaultRoute(
  config: GameConfig,
  state: AccountState,
  now: number,
  card: HoopaCard,
  seed?: number,
): Result<VaultRouteResult> {
  const block = locked(config, state, now);
  if (block) return block;
  const rules = vaultRules(config);
  const run = state.hoopaVault.run;
  if (!run) return fail('not_ready', ERROR_TEXT.no_run);
  if (run.atGuardian) return fail('not_ready', ERROR_TEXT.at_guardian);
  if (!run.offer.includes(card)) return fail('invalid_input', ERROR_TEXT.bad_card);
  const mult = rules.run.cards[card].enemyMult;
  const enemies = enemiesFor(config, rules.enemy, run.floor - 1).map((e) => ({ ...e, mult: { hp: mult, atk: mult, def: mult } }));
  const battle = modeBattle(config, state, {
    squadMode: 'hoopaVault',
    label: 'hoopaVault',
    enemies,
    battleId: `m13:hoopa:${run.floor}:${run.stage}:${card}`,
    rules: { roundLimit: routeRoundCap(run) },
    attackerBoost: run.attackBoost,
    seed,
  });
  if (!battle) return fail('not_found', 'no Wilds available for the Vault');
  const win = battle.winner === 'attackers';
  const settled = settleRoute(rules, state.hoopaVault, card, win, battle.rounds, heldNames(config));
  if (!settled.ok) return fail('invalid_input', ERROR_TEXT[settled.error]);
  let next: AccountState = { ...state, hoopaVault: settled.state };
  if (settled.ended) next = refund(next, run);
  return ok({
    state: next,
    battle,
    win,
    ended: settled.ended,
    drops: settled.drops.rewards,
    items: settled.drops.items,
    orbs: settled.drops.orbs,
    card,
  });
}

export interface VaultGuardianResult {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  /** Everything kept on a win (the bag plus the Guardian's pay). */
  kept: Rewards;
  items: BagItem[];
  orbs: BagOrb[];
  floor: number;
}

/** Fight the Exit Guardian: a fixed round count; a win keeps the bag and clears the floor. */
export function fightVaultGuardian(config: GameConfig, state: AccountState, now: number, seed?: number): Result<VaultGuardianResult> {
  const block = locked(config, state, now);
  if (block) return block;
  const rules = vaultRules(config);
  const run = state.hoopaVault.run;
  if (!run) return fail('not_ready', ERROR_TEXT.no_run);
  if (!run.atGuardian) return fail('not_ready', ERROR_TEXT.not_at_guardian);
  const enemies = enemiesFor(config, rules.enemy, run.floor - 1).map((e) => ({ ...e, mult: rules.guardian.mult }));
  const battle = modeBattle(config, state, {
    squadMode: 'hoopaVault',
    label: 'hoopaVault',
    enemies,
    battleId: `m13:hoopa:${run.floor}:guardian`,
    rules: { roundLimit: rules.guardian.rounds },
    attackerBoost: run.attackBoost,
    seed,
  });
  if (!battle) return fail('not_found', 'no Wilds available for the Vault');
  const win = battle.winner === 'attackers';
  const settled = settleGuardian(rules, state.hoopaVault, win, heldNames(config));
  if (!settled.ok) return fail('invalid_input', ERROR_TEXT[settled.error]);
  let next: AccountState = { ...state, hoopaVault: settled.state };
  next = win ? grantBag(config, applyGrant(config, next, settled.kept.rewards), settled.kept.items, settled.kept.orbs) : refund(next, run);
  return ok({
    state: next,
    battle,
    win,
    kept: settled.kept.rewards,
    items: settled.kept.items,
    orbs: settled.kept.orbs,
    floor: settled.floor,
  });
}

/** Leave the run: the bag is lost and the keys come back. */
export function exitVaultRun(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  const block = locked(config, state, now);
  if (block) return block;
  const left = exitRun(state.hoopaVault);
  if (!left.ok) return fail('not_ready', ERROR_TEXT[left.error]);
  return ok(refund({ ...state, hoopaVault: left.state }, left.run));
}

export { floorOpen, maxMultiplier };
