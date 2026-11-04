import { describe, expect, it } from 'vitest';
import { buildConfig, type GameConfig } from './config';
import {
  claimVaultKeys,
  exitVaultRun,
  fightVaultGuardian,
  fightVaultRoute,
  startVaultRun,
} from './hoopa-vault';
import { buildHoopaVaultView } from './hoopa-vault-view';
import { createInitialState } from './save';

const DAY = 86_400_000;
const EPOCH = Date.UTC(2026, 9, 1, 12);
/** Server day 15: the Vault's gate. */
const DAY15 = EPOCH + 14 * DAY;

function account(): { config: GameConfig; state: ReturnType<typeof createInitialState> } {
  const config = buildConfig();
  config.now = () => DAY15;
  const state = createInitialState(config);
  state.serverEpoch = EPOCH;
  state.roster = state.roster.map((wild) => ({ ...wild, level: 80, stars: 6 }));
  return { config, state };
}

describe("Hoopa's Vault server rules", () => {
  it('stays shut on server day 14 and opens on day 15', () => {
    const { config, state } = account();
    const early = claimVaultKeys(config, state, DAY15 - DAY);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toBe('resource_locked');
    expect(buildHoopaVaultView(config, state, DAY15 - DAY).unlocked).toBe(false);
    const view = buildHoopaVaultView(config, state, DAY15);
    expect(view.unlocked).toBe(true);
    expect(view.floors).toBe(300);
    expect(view.nextFloor).toBe(1);
    expect(view.maxMultiplier).toBe(1);
    expect(view.bandNote).toBe('Start dropping Rare quality held items');
  });

  it('gives five free keys once a day', () => {
    const { config, state } = account();
    const first = claimVaultKeys(config, state, DAY15);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.state.currencies.vaultKey).toBe((state.currencies.vaultKey ?? 0) + 5);
    expect(claimVaultKeys(config, first.value.state, DAY15).ok).toBe(false);
    expect(claimVaultKeys(config, first.value.state, DAY15 + DAY).ok).toBe(true);
  });

  it('reserves keys on start and refunds them on exit, with the bag lost', () => {
    const { config, state } = account();
    state.currencies.vaultKey = 2;
    expect(startVaultRun(config, state, DAY15, 2, 1).ok).toBe(false);
    expect(startVaultRun(config, state, DAY15, 1, 3).ok).toBe(false);
    const started = startVaultRun(config, state, DAY15, 1, 1, 11);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.currencies.vaultKey).toBe(1);
    expect(started.value.hoopaVault.run?.offer).toHaveLength(2);
    expect(startVaultRun(config, started.value, DAY15, 1, 1).ok).toBe(false);
    const left = exitVaultRun(config, started.value, DAY15);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.value.currencies.vaultKey).toBe(2);
    expect(left.value.hoopaVault.run).toBeNull();
  });

  it('fights a route battle: a win banks drops, a loss ends the run and refunds the key', () => {
    const { config, state } = account();
    state.currencies.vaultKey = 1;
    const started = startVaultRun(config, state, DAY15, 1, 1, 21);
    if (!started.ok) throw new Error(started.message);
    const card = started.value.hoopaVault.run!.offer[0]!;
    const fought = fightVaultRoute(config, started.value, DAY15, card, 5);
    expect(fought.ok).toBe(true);
    if (!fought.ok) return;
    const after = fought.value.state;
    if (fought.value.ended) {
      expect(after.hoopaVault.run).toBeNull();
      expect(after.currencies.vaultKey).toBe(1);
    } else {
      expect(fought.value.win).toBe(true);
      expect(after.hoopaVault.run?.stage).toBe(1);
      expect(after.hoopaVault.run?.bag.heldItemShard).toBeGreaterThan(0);
      expect(after.currencies.vaultKey).toBe(0);
    }
    expect(fightVaultGuardian(config, started.value, DAY15).ok).toBe(false);
  });

  it('settles the Exit Guardian: a win pays the bag and clears the floor, a loss refunds the key', () => {
    const { config, state } = account();
    state.currencies.vaultKey = 1;
    const started = startVaultRun(config, state, DAY15, 1, 1, 31);
    if (!started.ok) throw new Error(started.message);
    const atExit = {
      ...started.value,
      hoopaVault: {
        ...started.value.hoopaVault,
        run: {
          ...started.value.hoopaVault.run!,
          escape: 40,
          atGuardian: true,
          offer: [],
          bag: { heldItemShard: 7 },
          items: [{ defId: '101203', quality: 'rare' as const }],
          orbs: [{ colour: 'purple' as const, level: 1 }],
        },
      },
    };
    const fought = fightVaultGuardian(config, atExit, DAY15, 3);
    expect(fought.ok).toBe(true);
    if (!fought.ok) return;
    const after = fought.value.state;
    expect(after.hoopaVault.run).toBeNull();
    if (fought.value.win) {
      expect(after.hoopaVault.highest).toBe(1);
      expect(after.currencies.heldItemShard).toBeGreaterThanOrEqual((state.currencies.heldItemShard ?? 0) + 7);
      expect(after.currencies.vaultKey).toBe(0);
      // the banked Rare plus the Guardian's 3 items become real held items; the orb too
      expect(after.equipment.relics.length).toBe(atExit.equipment.relics.length + 4);
      expect(after.equipment.relics.some((r) => r.defId === '101203')).toBe(true);
      expect(after.equipment.orbs.length).toBe(atExit.equipment.orbs.length + 1);
    } else {
      expect(after.equipment.relics.length).toBe(atExit.equipment.relics.length);
      expect(after.hoopaVault.highest).toBe(0);
      expect(after.currencies.vaultKey).toBe(1);
    }
  });
});
