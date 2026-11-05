import { describe, expect, it } from 'vitest';
import { bossReward, guardianReward, xpForLevel } from '@wildbound/engine';
import { buildConfig, type GameConfig } from './config';
import { challengeGuardian, fightGroveBoss, groveRules, harvestGrove, plantGrove, prepareBerryGrove } from './berry-grove';
import { buildBerryGroveView } from './berry-grove-view';
import { createInitialState } from './save';

const NOW = Date.UTC(2026, 10, 8, 12);
const HOUR = 3_600_000;

function account(): { config: GameConfig; state: ReturnType<typeof createInitialState> } {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  state.campaign.stars['c3-10'] = 3;
  state.profile.level = 10;
  state.profile.xp = xpForLevel(10, config.xpCurve);
  state.roster = state.roster.map((w) => ({ ...w, level: 120, stars: w.stars + 4 }));
  state.currencies = { ...state.currencies, seedCommon: 2, seedGreater: 1 };
  return { config, state };
}

describe('Berry Grove', () => {
  it('stays locked before story 3-10 and trainer level 10', () => {
    const { config, state } = account();
    expect(plantGrove(config, { ...state, campaign: { ...state.campaign, stars: {} } }, NOW, 0, 'common').ok).toBe(false);
    const view = buildBerryGroveView(config, state, NOW);
    expect(view.unlocked).toBe(true);
    expect(view.plots).toHaveLength(6);
    expect(view.boss.name.length).toBeGreaterThan(0);
  });

  it('plants a seed, refuses an early harvest, then grows a berry of its tier plus Essence', () => {
    const { config, state } = account();
    const planted = plantGrove(config, state, NOW, 0, 'common');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;
    expect(planted.value.currencies.seedCommon).toBe(1);
    expect(plantGrove(config, planted.value, NOW, 0, 'common').ok).toBe(false);
    expect(harvestGrove(config, planted.value, NOW + HOUR, 0).ok).toBe(false);
    const before = planted.value.equipment.berries.length;
    const out = harvestGrove(config, planted.value, NOW + 2 * HOUR, 0);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.berries).toHaveLength(1);
    expect(out.value.state.equipment.berries.length).toBe(before + 1);
    const def = config.equipment.berries.berries.find((b) => b.id === out.value.berries[0]);
    expect(def?.tier).toBe('common');
    expect(out.value.rewards).toEqual({ berryEssence: 50 });
    expect(out.value.state.berryGrove!.plots[0]!.seed).toBeNull();
  });

  it('harvests every ripe plot at once and needs a seed to plant', () => {
    const { config, state } = account();
    let s = state;
    for (const [plot, tier] of [[0, 'common'], [1, 'common'], [2, 'greater']] as const) {
      const r = plantGrove(config, s, NOW, plot, tier);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.value;
    }
    expect(plantGrove(config, s, NOW, 3, 'common').ok).toBe(false);
    const out = harvestGrove(config, s, NOW + 3 * HOUR);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.berries).toHaveLength(2);
  });

  it('pays a Guardian first clear by band, with the tenth-stage extra', () => {
    const { config, state } = account();
    const rules = groveRules(config);
    expect(guardianReward(rules, 10)).toEqual({ seedCommon: 2, seedBasic: 1, berryMulchBlue: 2, reforgePotion: 2, seedGreater: 1, berryEssence: 500 });
    expect(guardianReward(rules, 99).berryMulchRed).toBe(2);
    const out = challengeGuardian(config, state, NOW, 5);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    if (out.value.win) {
      expect(out.value.state.berryGrove!.stage).toBe(1);
      expect(out.value.state.currencies.berryMulchBlue).toBe((state.currencies.berryMulchBlue ?? 0) + 2);
    }
  });

  it('fights the Grove Boss three times a day for berry materials scaled by the HP taken', () => {
    const { config, state } = account();
    const rules = groveRules(config);
    expect(bossReward(rules, 0, 0).berryMulchBlue).toBe(1);
    expect(bossReward(rules, 0, 1).berryMulchBlue).toBe(3);
    let s = prepareBerryGrove(config, state, NOW).state;
    for (let i = 0; i < 3; i += 1) {
      const out = fightGroveBoss(config, s, NOW, 11 + i);
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.value.share).toBeGreaterThanOrEqual(0);
      expect(out.value.rewards.berryMulchBlue).toBeGreaterThanOrEqual(1);
      s = out.value.state;
    }
    expect(fightGroveBoss(config, s, NOW, 1).ok).toBe(false);
    const tomorrow = fightGroveBoss(config, s, NOW + 24 * HOUR, 1);
    expect(tomorrow.ok).toBe(true);
  });
});
