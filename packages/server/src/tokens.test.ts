import { describe, expect, it } from 'vitest';
import { buildWildTeam, modeBattle } from './battle';
import { buildConfig } from './config';
import { createInitialState } from './save';
import { buildTokensView, grantTokenFragments, levelTokenAction, tokenPvpLines } from './tokens';

function makeState() {
  const config = buildConfig();
  const state = createInitialState(config);
  return { config, state };
}

describe('R8 Trainer Tokens from the source', () => {
  it('ships six tokens with five levels; Origin Emerald gates at 6 / 18 / 36 / 48 / 60', () => {
    const { config } = makeState();
    expect(config.tokens.tokens.map((t) => t.name)).toEqual([
      'Origin Emerald',
      'Sea Sound Bells',
      'Shadow Resonance Stone',
      'Ultra Prism',
      'Immortal Sword',
      'Snow Leaf Badge',
    ]);
    const emerald = config.tokens.tokens[0]!;
    expect(emerald.levels.map((l) => l.treasureTotal)).toEqual([6, 18, 36, 48, 60]);
    expect(emerald.levels.map((l) => l.cost)).toEqual([1, 2, 2, 3, 3]);
    expect(emerald.levels[4]!.lines).toEqual([
      { field: 'pvpBoost', value: 0.35 },
      { field: 'pvpRdct', value: 0.45 },
    ]);
    expect(config.tokens.tokens[1]!.levels.map((l) => l.treasureTotal)).toEqual([6, 24, 42, 54, 60]);
    // The source's own number: Ultra Prism level 3 Crit Res is 18%.
    expect(config.tokens.tokens[3]!.levels[2]!.lines).toContainEqual({ field: 'critRes', value: 0.18 });
  });

  it('levels a token only with its season treasure total and its own fragments', () => {
    const { config, state } = makeState();
    const locked = levelTokenAction(config, grantTokenFragments(state, 101, 1), 101);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toBe('resource_locked');
    expect(buildTokensView(config, state)[0]!.blocked).toBe('treasure');

    const ready = { ...state, trainerTokens: { ...state.trainerTokens, treasureTotals: { '1': 18 } } };
    const noFragments = levelTokenAction(config, ready, 101);
    expect(noFragments.ok).toBe(false);
    if (!noFragments.ok) expect(noFragments.error).toBe('insufficient_items');

    const one = levelTokenAction(config, grantTokenFragments(ready, 101, 3), 101);
    if (!one.ok) throw new Error(one.message);
    expect(one.value.trainerTokens.levels['101']).toBe(1);
    expect(one.value.trainerTokens.fragments['101']).toBe(2);
    const two = levelTokenAction(config, one.value, 101);
    if (!two.ok) throw new Error(two.message);
    expect(two.value.trainerTokens.levels['101']).toBe(2);
    expect(two.value.trainerTokens.fragments['101']).toBeUndefined();
    // Level 3 needs a total of 36.
    const three = levelTokenAction(config, grantTokenFragments(two.value, 101, 2), 101);
    expect(three.ok).toBe(false);
    // Each level's lines replace the last.
    expect(tokenPvpLines(config, two.value)).toEqual({ pvpBoost: 0.08, pvpRdct: 0.1 });
  });

  it('adds token lines to the sheet in PvP battles only', () => {
    const { config, state } = makeState();
    const leveled = { ...state, trainerTokens: { levels: { '501': 5 }, fragments: {}, treasureTotals: {} } };
    const wilds = state.roster.slice(0, 1);
    const pve = buildWildTeam(wilds, 'attackers', config, leveled);
    const pvp = buildWildTeam(wilds, 'attackers', config, leveled, tokenPvpLines(config, leveled));
    expect(pve.specs[0]!.sheet.pBoost ?? 0).toBe(0);
    expect(pvp.specs[0]!.sheet.pBoost).toBeCloseTo(0.3);
    expect(pvp.specs[0]!.sheet.pRdct).toBeCloseTo(0.3);

    const enemies = [{ speciesId: state.roster[0]!.speciesId, level: 1, stars: 1, stage: 0 }];
    const opts = { squadMode: 'arenaAttack' as const, label: 'arenaFight' as const, enemies, battleId: 't', seed: 7 };
    expect(modeBattle(config, leveled, { ...opts, pvp: true })).not.toBeNull();
  });
});
