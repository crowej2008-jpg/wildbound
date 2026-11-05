import { describe, expect, it } from 'vitest';
import { itemFree, newWall, strike, xpForLevel } from '@wildbound/engine';
import { buildConfig, type GameConfig } from './config';
import { collectCured, cureFossil, digRules, displayPiece, donateSpares, leaveDigWall, museumLines, startWall, strikeWall } from './dig-site';
import { buildDigSiteView } from './dig-site-view';
import { equippedSheet } from './battle';
import { createInitialState } from './save';

const NOW = Date.UTC(2026, 10, 8, 12);
const HOUR = 3_600_000;

function account(): { config: GameConfig; state: ReturnType<typeof createInitialState> } {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  state.campaign.stars['c10-10'] = 3;
  state.profile.level = 50;
  state.profile.xp = xpForLevel(50, config.xpCurve);
  state.currencies = { ...state.currencies, gold: 10_000_000 };
  return { config, state };
}

describe('Dig Site', () => {
  it('builds walls with items and bedrock that never overlap', () => {
    const rules = digRules(buildConfig());
    for (let s = 1; s < 50; s += 1) {
      const w = newWall(rules, s * 31);
      expect(w.items.length).toBeGreaterThanOrEqual(1);
      const cells = [...w.items.flatMap((i) => i.cells), ...w.bedrock];
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it('wears rock with the pick and hammer, and collapses at the stability', () => {
    const rules = digRules(buildConfig());
    let w = newWall(rules, 7);
    const before = w.depth[14]!;
    w = strike(rules, w, 'pick', 1, 1);
    expect(w.shake).toBe(rules.tools.pick.shake);
    if (!w.bedrock.includes(14)) expect(w.depth[14]).toBe(Math.max(0, before - rules.tools.pick.center));
    while (!w.over) w = strike(rules, w, 'hammer', 0, 0);
    expect(w.collapsed || w.items.every((i) => itemFree(w, i))).toBe(true);
  });

  it('stays locked before story 10-10 and level 50; the view hides buried items', () => {
    const { config, state } = account();
    expect(startWall(config, { ...state, campaign: { ...state.campaign, stars: {} } }, NOW).ok).toBe(false);
    const started = startWall(config, state, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const view = buildDigSiteView(config, started.value.state, NOW);
    expect(view.wall!.cells).toHaveLength(130);
    expect(view.wall!.cells.every((c) => c.item === null)).toBe(true);
  });

  it('pays fully dug-out items when the wall ends: soul hearts join the equipment', () => {
    const { config, state } = account();
    const rules = digRules(config);
    const started = startWall(config, state, NOW);
    if (!started.ok) throw new Error('no wall');
    let s = started.value.state;
    // Clear every item with perfect knowledge (a test cheat), then leave.
    for (const item of s.digSite!.wall!.items) {
      for (const c of item.cells) {
        while (!s.digSite!.wall!.over && s.digSite!.wall!.depth[c]! > 0) {
          const out = strikeWall(config, s, NOW, 'pick', c % rules.width, Math.floor(c / rules.width));
          if (!out.ok) throw new Error(out.message);
          s = out.value.state;
        }
      }
    }
    if (!s.digSite!.wall!.over) {
      const left = leaveDigWall(config, s, NOW);
      if (!left.ok) throw new Error('leave');
      s = left.value.state;
    }
    const wall = s.digSite!.wall!;
    const hearts = wall.items.filter((i) => i.id.startsWith('soul-') && itemFree(wall, i)).length;
    expect(s.equipment.cores.length).toBe(state.equipment.cores.length + hearts);
  });

  it('cures a fossil over time for Gold and displays it in the museum for stats', () => {
    const { config, state } = account();
    const s0 = { ...state, digSite: { wall: null, walls: 0, fossils: { 'fossil-helix': 1 }, lab: [null, null, null], storage: {}, museum: [] } };
    const cured = cureFossil(config, s0, NOW, 'fossil-helix');
    expect(cured.ok).toBe(true);
    if (!cured.ok) return;
    expect(cured.value.currencies.gold).toBe(state.currencies.gold - 100_000);
    expect(collectCured(config, cured.value, NOW + HOUR).ok).toBe(false);
    const collected = collectCured(config, cured.value, NOW + 2 * HOUR);
    expect(collected.ok).toBe(true);
    if (!collected.ok) return;
    const wild = state.roster[0]!;
    const before = equippedSheet(wild, config, collected.value.state)!.sheet.hp;
    const shown = displayPiece(config, collected.value.state, NOW, 'fossil-helix');
    expect(shown.ok).toBe(true);
    if (!shown.ok) return;
    expect(museumLines(config, shown.value)).toHaveLength(3);
    expect(equippedSheet(wild, config, shown.value)!.sheet.hp - before).toBeGreaterThanOrEqual(3000);
  });

  it('adds a group bonus when a group is complete and turns spares into EXP', () => {
    const { config, state } = account();
    const shells = config.digSite.pieces.filter((p) => p.group === 'shells').map((p) => p.id);
    const s = { ...state, digSite: { wall: null, walls: 0, fossils: {}, lab: [null, null, null], storage: { 'treasure-red-shard': 3 }, museum: shells } };
    expect(museumLines(config, s).filter((l) => l.kind === 'percent')).toHaveLength(3);
    const donated = donateSpares(config, s, NOW);
    expect(donated.ok).toBe(true);
    if (donated.ok) expect(donated.value.exp).toBe(2 * config.digSite.duplicateExp.treasure);
  });
});
