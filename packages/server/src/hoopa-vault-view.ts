import {
  dayKey,
  floorBand,
  keysClaimable,
  maxMultiplier,
  routeRoundCap,
  type AccountState,
  type HoopaCard,
  type Rewards,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { hoopaVaultGate, vaultRules } from './hoopa-vault';

/** Display-ready Hoopa's Vault view (M13.3). Pure reads. */

export interface HoopaCardView {
  card: HoopaCard;
  escape: number;
  /** Enemy stat multiplier (1 = normal). */
  enemyMult: number;
  attackBoost: number;
  dropBoost: number;
}

export interface HoopaRunView {
  floor: number;
  multiplier: number;
  escape: number;
  hoopa: number;
  target: number;
  stage: number;
  roundCap: number;
  offer: HoopaCardView[];
  attackBoost: number;
  dropBoost: number;
  bag: Rewards;
  /** Held items banked (name and quality only: lines roll when kept, as in the source). */
  items: { name: string; quality: string }[];
  orbs: { colour: string; level: number }[];
  atGuardian: boolean;
  guardianRounds: number;
}

export interface HoopaVaultView {
  unlocked: boolean;
  serverDay: number;
  unlockDay: number;
  keys: number;
  keysClaimable: boolean;
  freeKeysPerDay: number;
  highest: number;
  floors: number;
  /** The next floor to clear (highest + 1, capped). */
  nextFloor: number;
  maxMultiplier: number;
  /** What the next floor's source band adds (e.g. "Start dropping Epic quality held items"). */
  bandNote: string | null;
  /** Upcoming band starts, for the "what's next" list. */
  upcoming: { floor: number; note: string }[];
  run: HoopaRunView | null;
}

export function buildHoopaVaultView(config: GameConfig, state: AccountState, now: number): HoopaVaultView {
  const rules = vaultRules(config);
  const vault = state.hoopaVault;
  const nextFloor = Math.min(rules.floors, vault.highest + 1);
  const run = vault.run;
  const gate = config.explore.modes.find((m) => m.id === 'hoopa-vault')?.gates.find((g) => g.kind === 'serverDay');
  const cardView = (card: HoopaCard): HoopaCardView => ({ card, ...rules.run.cards[card] });
  return {
    unlocked: hoopaVaultGate(config, state, now),
    serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
    unlockDay: gate && 'day' in gate ? gate.day : 15,
    keys: state.currencies.vaultKey ?? 0,
    keysClaimable: keysClaimable(vault, dayKey(now)),
    freeKeysPerDay: rules.freeKeysPerDay,
    highest: vault.highest,
    floors: rules.floors,
    nextFloor,
    maxMultiplier: maxMultiplier(rules, vault.highest),
    bandNote: floorBand(rules, nextFloor)?.note ?? null,
    upcoming: rules.bands.filter((b) => b.floor > vault.highest).slice(0, 4).map((b) => ({ floor: b.floor, note: b.note })),
    run: run
      ? {
          floor: run.floor,
          multiplier: run.multiplier,
          escape: run.escape,
          hoopa: run.hoopa,
          target: rules.run.target,
          stage: run.stage,
          roundCap: routeRoundCap(run),
          offer: run.offer.map(cardView),
          attackBoost: run.attackBoost,
          dropBoost: run.dropBoost,
          bag: run.bag,
          items: run.items.map((i) => ({ name: config.equipment.relics.find((d) => d.id === i.defId)?.name ?? i.defId, quality: i.quality })),
          orbs: run.orbs.map((o) => ({ ...o })),
          atGuardian: run.atGuardian,
          guardianRounds: rules.guardian.rounds,
        }
      : null,
  };
}
