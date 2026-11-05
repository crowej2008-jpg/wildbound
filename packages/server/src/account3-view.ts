import type { AccountState, Faction } from '@wildbound/engine';
import type { GameConfig } from './config';
import { awakeningOpen, awakeningProgress, crystalCap, initialAccount3, resonanceLevel3, treasureCost, treasureSkillLevel, treasureUnlocked } from './account3';

/** Display-ready Account systems III view (M15). */
export interface Account3View {
  treasures: {
    type: number;
    name: string;
    gymName: string;
    unlocked: boolean;
    level: number;
    accessory: number;
    refine: number;
    star: number;
    faction: Faction | null;
    skillLevel: number;
    skillText: string;
    costs: { level: number | null; accessory: number | null; refine: number | null; star: number | null };
  }[];
  resonance: number;
  wristband: { level: number; next: number | null };
  crystals: { faction: Faction; level: number; cap: number; next: number | null }[];
  fusion: { id: number; name: string; level: number; shards: number; next: number | null; perk: string; perkValue: number }[];
  egg: { points: number; freeLeft: number; vouchers: number; shop: { id: number; species: string; name: string; shards: number; price: number; left: number }[] };
  awaken: { open: boolean; wildId: string | null; progress: number; need: number; candidates: { id: string; name: string }[] };
  currencies: Record<string, number>;
}

export function buildAccount3View(config: GameConfig, state: AccountState, now: number): Account3View {
  const t = config.account3;
  const cur = state.account3 ?? initialAccount3();
  const name = (id: string) => config.species.get(id)?.name ?? id;
  const c = state.currencies as unknown as Record<string, number>;
  return {
    treasures: t.treasures.list.map((x) => {
      const s = cur.treasures[String(x.type)] ?? { level: 1, accessory: 0, refine: 0, star: 0, faction: null };
      const sl = treasureSkillLevel(config, state, x.type);
      return {
        type: x.type,
        name: x.name,
        gymName: x.gymName,
        unlocked: treasureUnlocked(config, state, x.type),
        level: s.level,
        accessory: s.accessory,
        refine: s.refine,
        star: s.star,
        faction: s.faction,
        skillLevel: sl,
        skillText: x.skills.find((k) => k.level === Math.max(1, sl))?.text ?? '',
        costs: {
          level: treasureCost(config, state, x.type, 'level'),
          accessory: treasureCost(config, state, x.type, 'accessory'),
          refine: treasureCost(config, state, x.type, 'refine'),
          star: treasureCost(config, state, x.type, 'star'),
        },
      };
    }),
    resonance: resonanceLevel3(config, state),
    wristband: { level: cur.wristband, next: t.wristband.levels.find((l) => l.level === cur.wristband + 1)?.cost ?? null },
    crystals: t.wristband.crystals.map((x) => {
      const lv = cur.crystals[x.faction] ?? 0;
      return { faction: x.faction, level: lv, cap: crystalCap(config, cur.wristband), next: x.levels.find((l) => l.level === lv + 1)?.cost ?? null };
    }),
    fusion: t.fusion.map((f) => {
      const lv = cur.fusion[String(f.id)] ?? 0;
      return { id: f.id, name: f.name, level: lv, shards: cur.fusionShards[String(f.id)] ?? 0, next: f.levels.find((l) => l.level === lv + 1)?.cost ?? null, perk: f.perk, perkValue: f.levels.find((l) => l.level === lv)?.perkValue ?? 0 };
    }),
    egg: {
      points: cur.egg.points,
      freeLeft: cur.egg.day === new Date(now).toISOString().slice(0, 10) ? Math.max(0, t.egg.freePerDay - cur.egg.free) : t.egg.freePerDay,
      vouchers: c.goldenEggVoucher ?? 0,
      shop: t.egg.shop.map((r) => ({ id: r.id, species: r.species!, name: name(r.species!), shards: r.shards, price: r.price, left: r.limit - (cur.egg.bought[String(r.id)] ?? 0) })),
    },
    awaken: {
      open: awakeningOpen(config, state, now),
      wildId: cur.awaken.wildId,
      progress: awakeningProgress(config, state),
      need: t.awaken.need,
      candidates: state.roster.filter((w) => w.stars === 18).map((w) => ({ id: w.id, name: name(w.speciesId) })),
    },
    currencies: Object.fromEntries(['treasureLiquid', 'treasureAccessory', 'treasureRefine', 'treasureAwakenStone', 'wristbandEssence', 'crystalEssence', 'goldenEggVoucher', 'awakeningStone'].map((k) => [k, c[k] ?? 0])),
  };
}
