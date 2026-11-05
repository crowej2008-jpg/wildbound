import { describe, expect, it } from 'vitest';
import type { WildInstance } from '@wildbound/engine';
import { buildConfig, firstStar, type GameConfig } from './config';
import { climbFactionTower, factionEnemies, factionTeam, sweepFactionTower } from './faction-tower';
import { buildFactionTowerView } from './faction-tower-view';
import { createInitialState } from './save';

const SUNDAY = Date.UTC(2026, 10, 8, 12);
const MONDAY = Date.UTC(2026, 10, 9, 12);

function account(level = 200): { config: GameConfig; state: ReturnType<typeof createInitialState> } {
  const config = buildConfig();
  config.now = () => SUNDAY;
  const state = createInitialState(config);
  state.campaign.stars['c28-10'] = 3;
  const pick = (faction: string, n: number) =>
    [...config.species.values()].filter((s) => s.faction === faction).slice(0, n);
  const species = [...pick('water', 8), ...pick('fire', 4), ...pick('light', 2), ...pick('dark', 2)];
  state.roster = species.map((s, i): WildInstance => ({ id: `w${i + 1}`, speciesId: s.id, level, stars: firstStar(s) + 4, locked: false, acquiredAt: 0 }) as WildInstance);
  state.squads.factionTower = Array(6).fill(null);
  state.squads.factionTower2 = Array(6).fill(null);
  return { config, state };
}

describe('Faction Tower server rules', () => {
  it('stays locked before story 28-10', () => {
    const { config, state } = account();
    const locked = climbFactionTower(config, { ...state, campaign: { ...state.campaign, stars: {} } }, SUNDAY, 'water', 1);
    expect(locked.ok).toBe(false);
    expect(buildFactionTowerView(config, state, SUNDAY).unlocked).toBe(true);
  });

  it('auto-fills a team with at least 4 of the tower type plus Light and Dark', () => {
    const { config, state } = account();
    const team = factionTeam(config, state, 'water', 'factionTower');
    const factions = team.map((w) => config.species.get(w.speciesId)!.faction);
    expect(team).toHaveLength(6);
    expect(factions.every((f) => ['water', 'light', 'dark'].includes(f))).toBe(true);
    expect(factions.filter((f) => f === 'water').length).toBeGreaterThanOrEqual(4);
    // Fire has four on the roster: they all go in.
    expect(factionTeam(config, state, 'fire', 'factionTower').filter((w) => config.species.get(w.speciesId)!.faction === 'fire')).toHaveLength(4);
  });

  it('climbs floor 1 and pays the floor (30,000 Gold, 150 Star Shards, 330 coins)', () => {
    const { config, state } = account();
    const out = climbFactionTower(config, state, SUNDAY, 'water', 7);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.fights).toHaveLength(1);
    expect(out.value.win).toBe(true);
    expect(out.value.state.factionTower.floors.water).toBe(1);
    expect(out.value.rewards).toEqual({ gold: 30000, starShard: 150, factionCoin: 330 });
    expect(out.value.state.currencies.factionCoin).toBe((state.currencies.factionCoin ?? 0) + 330);
  });

  it('pays the floor-10 milestone: a Powerful Evolve box Pokémon', () => {
    const { config, state } = account();
    const at9 = { ...state, factionTower: { ...state.factionTower, floors: { water: 9, fire: 0, grass: 0 } } };
    const out = climbFactionTower(config, at9, SUNDAY, 'water', 7);
    expect(out.ok).toBe(true);
    if (!out.ok || !out.value.win) return;
    expect(out.value.pokemon).toHaveLength(1);
    expect(config.factionTower.evolveBoxes.water.map((r) => r.species)).toContain(out.value.pokemon[0]);
    expect(out.value.state.roster.length).toBe(state.roster.length + 1);
  });

  it('closes the Fire Tower on Monday and fights twice from floor 701', () => {
    const { config, state } = account();
    const closed = climbFactionTower(config, state, MONDAY, 'fire', 1);
    expect(closed.ok).toBe(false);
    const at700 = { ...state, factionTower: { ...state.factionTower, floors: { water: 700, fire: 0, grass: 0 } } };
    const view = buildFactionTowerView(config, at700, SUNDAY);
    expect(view.towers[0]!.teams).toBe(2);
    expect(factionEnemies(config, 'water', 701, 1)).toHaveLength(6);
    expect(factionEnemies(config, 'water', 701, 2)).not.toEqual(factionEnemies(config, 'water', 701, 1));
    const out = climbFactionTower(config, at700, SUNDAY, 'water', 3);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.fights.length).toBeGreaterThanOrEqual(1);
    if (out.value.win) expect(out.value.fights).toHaveLength(2);
  });

  it('refuses a team short of the tower type', () => {
    const { config, state } = account();
    const out = climbFactionTower(config, state, SUNDAY, 'grass', 1);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toContain('4 Grass');
  });

  it('sweeps the highest floor: two free, then 10 and 20 Diamonds', () => {
    const { config, state } = account();
    let s = { ...state, currencies: { ...state.currencies, gems: 100 }, factionTower: { ...state.factionTower, floors: { water: 50, fire: 0, grass: 0 } } };
    const prices: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const out = sweepFactionTower(config, s, SUNDAY, 'water');
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.value.rewards).toEqual({ gold: 34500, starShard: 375, factionCoin: 370 });
      prices.push(out.value.price);
      s = out.value.state;
    }
    expect(prices).toEqual([0, 0, 10, 20]);
    expect(s.currencies.gems).toBe(70);
    expect(sweepFactionTower(config, s, SUNDAY, 'water').ok).toBe(false);
  });
});
