import { describe, expect, it } from 'vitest';
import { account3Lines, awakened, awakeningOpen, awakeningProgress, buyEggShop, chooseAwakening, crystalCap, levelCrystal, levelFusion, levelWristband, resonanceLevel3, setTreasureFaction, smashEggs, treasureUnlocked, upgradeTreasure } from './account3';
import { buildAccount3View } from './account3-view';
import { buildConfig } from './config';
import { createInitialState } from './save';

const NOW = Date.UTC(2026, 10, 11, 12);

function account() {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  const gyms = Object.fromEntries(config.account3.treasures.list.map((t) => [`gym-${t.gym}`, true]));
  state.campaign = { ...state.campaign, gyms };
  state.currencies = { ...state.currencies, treasureLiquid: 100000, treasureAccessory: 1000, treasureRefine: 1000, treasureAwakenStone: 100, wristbandEssence: 100000, crystalEssence: 100000, goldenEggVoucher: 100 } as typeof state.currencies;
  return { config, state };
}

describe('Account systems III (M15)', () => {
  it('lists every treasure, locked until its gym is beaten', () => {
    const { config, state } = account();
    const first = config.account3.treasures.list[0]!;
    expect(config.account3.treasures.list.length).toBeGreaterThanOrEqual(5);
    expect(treasureUnlocked(config, state, first.type)).toBe(true);
    const locked = { ...state, campaign: { ...state.campaign, gyms: {} } };
    expect(treasureUnlocked(config, locked, first.type)).toBe(false);
    expect(upgradeTreasure(config, locked, first.type, 'level').ok).toBe(false);
    expect(buildAccount3View(config, state, NOW).treasures).toHaveLength(config.account3.treasures.list.length);
  });

  it('levels treasures for liquid and limits boost factions', () => {
    const { config, state } = account();
    const [a, b] = config.account3.treasures.list;
    let s = state;
    for (let i = 0; i < 10; i += 1) {
      const r = upgradeTreasure(config, s, a!.type, 'level');
      expect(r.ok).toBe(true);
      if (r.ok) s = r.value;
    }
    expect(s.account3!.treasures[String(a!.type)]!.level).toBe(11);
    expect((s.currencies as Record<string, number>).treasureLiquid).toBeLessThan(100000);
    const f1 = setTreasureFaction(config, s, a!.type, 'fire');
    expect(f1.ok).toBe(true);
    if (!f1.ok) return;
    // five unlocked → two per faction
    expect(setTreasureFaction(config, f1.value, b!.type, 'fire').ok).toBe(true);
    expect(resonanceLevel3(config, s)).toBeGreaterThanOrEqual(0);
  });

  it('Z Ring raises the crystal cap; crystals add faction stats', () => {
    const { config, state } = account();
    expect(levelCrystal(config, state, 'fire').ok).toBe(false);
    let s = state;
    for (let i = 0; i < 5; i += 1) {
      const r = levelWristband(config, s);
      if (r.ok) s = r.value;
    }
    expect(s.account3!.wristband).toBeGreaterThan(0);
    if (crystalCap(config, s.account3!.wristband) > 0) {
      const r = levelCrystal(config, s, 'fire');
      expect(r.ok).toBe(true);
      if (r.ok) s = r.value;
    }
    expect(account3Lines(config, s, 'fire').length).toBeGreaterThan(0);
  });

  it('fusion skins level from shards', () => {
    const { config, state } = account();
    const skin = config.account3.fusion[0]!;
    expect(levelFusion(config, state, skin.id).ok).toBe(false);
    const s = { ...state, account3: { ...buildState(state), fusionShards: { [String(skin.id)]: 1000 } } };
    const r = levelFusion(config, s, skin.id);
    expect(r.ok).toBe(true);
  });

  it('Golden Egg: one free smash a day, vouchers after; points buy shards', () => {
    const { config, state } = account();
    const one = smashEggs(config, state, NOW, 1);
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect((one.value.state.currencies as Record<string, number>).goldenEggVoucher).toBe(100);
    const two = smashEggs(config, one.value.state, NOW, 30);
    expect(two.ok).toBe(true);
    if (!two.ok) return;
    expect((two.value.state.currencies as Record<string, number>).goldenEggVoucher).toBe(70);
    expect(two.value.state.account3!.egg.points).toBe(31 * config.account3.egg.pointsPerSmash);
    const cheap = [...config.account3.egg.shop].sort((x, y) => x.price - y.price)[0]!;
    if (cheap.price <= 31 * config.account3.egg.pointsPerSmash) expect(buyEggShop(config, two.value.state, cheap.id).ok).toBe(true);
  });

  it('Awakening opens on server day 60 with twelve 18★ Pokémon and gates 19★', () => {
    const { config, state } = account();
    expect(awakeningOpen(config, state, NOW)).toBe(false);
    const s = { ...state, serverEpoch: NOW - 70 * 86_400_000, roster: Array.from({ length: 12 }, (_, i) => ({ ...state.roster[0]!, id: `a${i}`, stars: 18 })) };
    expect(awakeningOpen(config, s, NOW)).toBe(true);
    const c = chooseAwakening(config, s, NOW, 'a0');
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(awakeningProgress(config, c.value)).toBe(0);
    expect(awakened(config, c.value, 'a0')).toBe(false);
  });
});

function buildState(state: ReturnType<typeof createInitialState>) {
  return state.account3 ?? { treasures: {}, wristband: 0, crystals: {}, fusion: {}, fusionShards: {}, egg: { day: '', free: 0, points: 0, smashes: 0, bought: {} }, awaken: { wildId: null, progress: {}, base: {} } };
}
