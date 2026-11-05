import { catchChance, dexStars, gearFloor, maxStamina, paradiseEndsIn, paradiseSeason, trackChance, type AccountState, type Rewards } from '@wildbound/engine';
import type { GameConfig } from './config';
import { paradiseOpen, paradiseRules, prepareParadise } from './paradise';

/** Display-ready Pokémon Paradise view (M14.3). */

export interface ParadiseView {
  unlocked: boolean;
  season: number;
  endsInMs: number;
  stamina: number;
  maxStamina: number;
  exp: number;
  points: number;
  stars: number;
  trackChance: number;
  balls: { advanced: number; master: number; scanners: number };
  scenes: { name: string; open: boolean; gearLevel: number }[];
  gear: { type: number; name: string; level: number; nextExp: number | null }[];
  encounter: { species: string; name: string; step: number; chances: { poke: number; advanced: number; master: number } } | null;
  dex: { id: number; species: string; name: string; star: number; logged: boolean[]; caught: boolean }[];
  starRewards: { stars: number; rewards: Rewards; claimed: boolean; boxes: number }[];
  shop: { id: number; rewards: Rewards; boxes: number; points?: number; exp?: number; left: number; locked: boolean }[];
}

export function buildParadiseView(config: GameConfig, state: AccountState, now: number): ParadiseView {
  const rules = paradiseRules(config);
  const prepared = prepareParadise(config, state, now).state;
  const park = prepared.paradise!;
  const season = paradiseSeason(rules, park.cycle);
  const floor = gearFloor(park);
  const nameOf = (id: string) => config.species.get(id)?.name ?? id;
  const enc = park.encounter;
  const entry = enc ? season.dex.find((d) => d.id === enc.entry) : undefined;
  return {
    unlocked: paradiseOpen(state),
    season: season.season,
    endsInMs: paradiseEndsIn(rules, now),
    stamina: park.stamina,
    maxStamina: maxStamina(rules, park),
    exp: park.exp,
    points: park.points,
    stars: dexStars(rules, park),
    trackChance: trackChance(rules, park),
    balls: { advanced: prepared.currencies.ballAdvanced ?? 0, master: prepared.currencies.ballMaster ?? 0, scanners: prepared.currencies.scanner ?? 0 },
    scenes: season.scenes.map((s) => ({ name: s.name, open: s.gearLevel <= floor, gearLevel: s.gearLevel })),
    gear: rules.gear.map((g) => {
      const level = park.gear[String(g.type)] ?? 0;
      return { type: g.type, name: g.name, level, nextExp: g.levels.find((l) => l.level === level + 1)?.exp ?? null };
    }),
    encounter:
      enc && entry
        ? {
            species: entry.species,
            name: nameOf(entry.species),
            step: enc.step,
            chances: { poke: catchChance(rules, park, entry, 'poke'), advanced: catchChance(rules, park, entry, 'advanced'), master: 1 },
          }
        : null,
    dex: season.dex.map((d) => ({
      id: d.id,
      species: d.species,
      name: nameOf(d.species),
      star: d.star,
      logged: [0, 1, 2, 3].map((s) => park.logged.includes(`${d.id}:${s}`)),
      caught: park.logged.includes(`${d.id}:3`),
    })),
    starRewards: season.starRewards.map((r) => ({ stars: r.stars, rewards: r.rewards, claimed: park.claimed.includes(`stars:${r.stars}`), boxes: r.evolveBoxes?.length ?? 0 })),
    shop: season.shop.map((r) => ({
      id: r.id,
      rewards: r.rewards,
      boxes: r.evolveBoxes?.length ?? 0,
      ...(r.points ? { points: r.points } : {}),
      ...(r.exp ? { exp: r.exp } : {}),
      left: r.limit - (park.bought[String(r.id)] ?? 0),
      locked: floor < r.gearLevel,
    })),
  };
}
