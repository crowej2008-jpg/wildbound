import { reachable } from '@wildbound/engine';
import { describe, expect, it } from 'vitest';
import { buildConfig, type GameConfig } from './config';
import { hireMisty, mistyRules, mistyShop, prepareMisty, stepMisty } from './misty';
import { buildMistyView } from './misty-view';
import { createInitialState } from './save';

const NOW = Date.UTC(2026, 10, 5, 12);

function account(): { config: GameConfig; state: ReturnType<typeof createInitialState> } {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  state.campaign.stars['c3-10'] = 3;
  state.roster = state.roster.map((wild) => ({ ...wild, level: 60, stars: 5 }));
  return { config, state };
}

describe('Misty Woods server rules', () => {
  it('stays locked before story 3-10 and shows chapter 1 with its source map', () => {
    const { config, state } = account();
    const locked = stepMisty(config, { ...state, campaign: { ...state.campaign, stars: {} } }, NOW, 10201);
    expect(locked.ok).toBe(false);
    const view = buildMistyView(config, state, NOW);
    expect(view.unlocked).toBe(true);
    expect(view.chapter).toBe(1);
    expect(view.floors).toHaveLength(11);
    expect(view.floors[0]!.nodes[0]!.here).toBe(true);
    expect(view.floors[10]!.nodes[0]!.tile).toBe('boss');
    expect(view.floors[10]!.nodes[0]!.gems).toBe(10);
  });

  it('fights a floor with carried HP: a win pays its Forest Coins and moves the team', () => {
    const { config, state } = account();
    const prepared = prepareMisty(config, state, NOW).state;
    const next = reachable(mistyRules(config), prepared.misty!).find((n) => n.tiles.includes('fight'))!;
    const out = stepMisty(config, prepared, NOW, next.id, 3);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    if (out.value.win) {
      expect(out.value.state.misty!.at).toBe(next.id);
      expect(out.value.state.currencies.forestCoin).toBe((prepared.currencies.forestCoin ?? 0) + 105);
      expect(Object.keys(out.value.state.misty!.hp).length).toBeGreaterThan(0);
    } else {
      expect(out.value.state.misty!.at).toBe(prepared.misty!.at);
    }
  });

  it('hires an offered helper and sells heals at the shop for Diamonds', () => {
    const { config, state } = account();
    const prepared = prepareMisty(config, state, NOW).state;
    const offer = { ...prepared, misty: { ...prepared.misty!, hireOffer: ['mew'] } };
    const hired = hireMisty(config, offer, NOW, 'mew');
    expect(hired.ok).toBe(true);
    if (!hired.ok) return;
    expect(hired.value.misty!.helpers).toHaveLength(1);
    expect(mistyShop(config, prepared, NOW, 'heal').ok).toBe(false);
    const shopNode = mistyRules(config).nodes.find((n) => n.tiles.includes('shop'))!;
    const atShop = {
      ...prepared,
      currencies: { ...prepared.currencies, gems: 500 },
      misty: { ...prepared.misty!, at: shopNode.id, rolled: { ...prepared.misty!.rolled, [String(shopNode.id)]: 'shop' as const }, hp: { a: 0.2 } },
    };
    const healed = mistyShop(config, atShop, NOW, 'heal');
    expect(healed.ok).toBe(true);
    if (!healed.ok) return;
    expect(healed.value.misty!.hp.a).toBe(1);
    expect(healed.value.currencies.gems).toBe(450);
  });

  it('keeps chapter 4 shut until story 20-10', () => {
    const { config, state } = account();
    const prepared = prepareMisty(config, state, NOW).state;
    const ch4 = mistyRules(config).nodes.find((n) => n.chapter === 4 && n.floor === 2)!;
    const at4 = { ...prepared, misty: { ...prepared.misty!, chapter: 4, at: ch4.pre[0]! } };
    const shut = stepMisty(config, at4, NOW, ch4.id);
    expect(shut.ok).toBe(false);
    if (!shut.ok) expect(shut.message).toContain('20-10');
  });
});
