import { describe, expect, it } from 'vitest';
import { dexStars, paradiseSeason } from '@wildbound/engine';
import { buildConfig } from './config';
import { buyParadiseShop, exploreParadise, paradiseRules, prepareParadise, throwParadiseBall, trackParadise, upgradeParadiseGear } from './paradise';
import { buildParadiseView } from './paradise-view';
import { createInitialState } from './save';

const NOW = Date.UTC(2026, 10, 8, 12);

function account() {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  state.campaign.stars['c2-5'] = 3;
  return { config, state };
}

describe('Pokémon Paradise', () => {
  it('stays shut before story 2-5 and shows the Park', () => {
    const { config, state } = account();
    expect(exploreParadise(config, { ...state, campaign: { ...state.campaign, stars: {} } }, NOW).ok).toBe(false);
    const view = buildParadiseView(config, state, NOW);
    expect(view.unlocked).toBe(true);
    expect(view.dex).toHaveLength(16);
    expect(view.stamina).toBe(10);
  });

  it('explores, tracks and throws until stamina runs out; logs Dex steps and EXP', () => {
    const { config, state } = account();
    let s = prepareParadise(config, state, NOW).state;
    let explores = 0;
    let caught = 0;
    for (let i = 0; i < 200 && (s.paradise!.stamina > 0 || s.paradise!.encounter); i += 1) {
      if (!s.paradise!.encounter) {
        const e = exploreParadise(config, s, NOW);
        if (!e.ok) break;
        s = e.value;
        explores += 1;
        continue;
      }
      if (s.paradise!.encounter.step < 3) {
        const tr = trackParadise(config, s, NOW);
        if (!tr.ok) throw new Error(tr.message);
        s = tr.value.state;
      } else {
        const th = throwParadiseBall(config, s, NOW, 'poke');
        if (!th.ok) throw new Error(th.message);
        if (th.value.caught) caught += 1;
        s = th.value.state;
      }
    }
    expect(explores).toBeGreaterThanOrEqual(10);
    expect(s.paradise!.exp).toBe(explores * paradiseRules(config).exploreExp);
    expect(dexStars(paradiseRules(config), s.paradise!)).toBeGreaterThan(0);
    expect(s.roster.length).toBe(state.roster.length + caught);
  });

  it('levels gear with Exploration EXP and gates shop offers by gear level', () => {
    const { config, state } = account();
    const s = prepareParadise(config, state, NOW).state;
    const rich = { ...s, paradise: { ...s.paradise!, exp: 10_000, points: 1000 } };
    const up = upgradeParadiseGear(config, rich, NOW, 1);
    expect(up.ok).toBe(true);
    if (up.ok) expect(up.value.paradise!.gear['1']).toBe(1);
    const season = paradiseSeason(paradiseRules(config), rich.paradise!.cycle);
    const open = season.shop.find((r) => r.gearLevel === 0 && r.points)!;
    const gated = season.shop.find((r) => r.gearLevel > 0)!;
    expect(buyParadiseShop(config, rich, NOW, open.id).ok).toBe(true);
    expect(buyParadiseShop(config, rich, NOW, gated.id).ok).toBe(false);
  });

  it('a new Park resets gear, Dex and points but keeps balls', () => {
    const { config, state } = account();
    const s = prepareParadise(config, state, NOW).state;
    const used = { ...s, currencies: { ...s.currencies, ballMaster: 2 }, paradise: { ...s.paradise!, gear: { 1: 5, 2: 5, 3: 5 }, points: 500, logged: ['1101:0'] } };
    const later = prepareParadise(config, used, NOW + 15 * 86_400_000).state;
    expect(later.paradise!.gear['1']).toBe(0);
    expect(later.paradise!.points).toBe(0);
    expect(later.paradise!.logged).toHaveLength(0);
    expect(later.currencies.ballMaster).toBe(2);
  });
});
