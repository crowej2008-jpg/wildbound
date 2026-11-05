import { floorRule, mistyCycleEndsIn, reachable, tileOf, type AccountState, type MistyTile } from '@wildbound/engine';
import type { GameConfig } from './config';
import { mistyGate, mistyRules, mistyTeam, prepareMisty } from './misty';

/** Display-ready Misty Woods view (M13.6). Pure reads of a rolled-forward run. */

export interface MistyNodeView {
  id: number;
  floor: number;
  pos: number;
  tile: MistyTile;
  done: boolean;
  here: boolean;
  reachable: boolean;
  /** First-win Forest Coins / Diamonds for a fight or boss on a floor not yet paid. */
  forestCoin: number;
  gems: number;
}

export interface MistyUnitView {
  id: string;
  name: string;
  hp: number;
  fallen: boolean;
  helper: boolean;
}

export interface MistyView {
  unlocked: boolean;
  cycleEndsInMs: number;
  chapter: number;
  chaptersCleared: number[];
  chapter4Locked: boolean;
  /** The current chapter's floors, low to high, each with its nodes. */
  floors: { floor: number; nodes: MistyNodeView[] }[];
  team: MistyUnitView[];
  hireOffer: { speciesId: string; name: string }[] | null;
  atShop: boolean;
  shop: { healAll: number; revive: number };
  gems: number;
  forestCoin: number;
}

export function buildMistyView(config: GameConfig, state: AccountState, now: number): MistyView {
  const rules = mistyRules(config);
  const prepared = prepareMisty(config, state, now).state;
  const misty = prepared.misty!;
  const next = new Set(reachable(rules, misty).map((n) => n.id));
  const nodes = rules.nodes.filter((n) => n.chapter === misty.chapter);
  const floors: MistyView['floors'] = [];
  for (let floor = 1; floor <= 11; floor += 1) {
    const row = nodes
      .filter((n) => n.floor === floor)
      .sort((a, b) => a.pos - b.pos)
      .map((n) => {
        const tile = tileOf(misty, n);
        const rule = floorRule(rules, n.chapter, n.floor);
        const unpaid = (tile === 'fight' || tile === 'boss') && !misty.paid.includes(`${n.chapter}:${n.floor}`);
        return {
          id: n.id,
          floor: n.floor,
          pos: n.pos,
          tile,
          done: misty.done.includes(n.id),
          here: misty.at === n.id,
          reachable: next.has(n.id),
          forestCoin: unpaid ? (rule?.forestCoin ?? 0) : 0,
          gems: unpaid ? (rule?.gems ?? 0) : 0,
        };
      });
    if (row.length > 0) floors.push({ floor, nodes: row });
  }
  const team = mistyTeam(prepared, { ...misty, fallen: [] });
  const fallen = new Set(misty.fallen);
  const nameOf = (speciesId: string) => config.species.get(speciesId)?.name ?? speciesId;
  const here = rules.nodes.find((n) => n.id === misty.at);
  return {
    unlocked: mistyGate(config, state, now),
    cycleEndsInMs: mistyCycleEndsIn(rules, now),
    chapter: misty.chapter,
    chaptersCleared: misty.chaptersCleared,
    chapter4Locked: !(prepared.campaign.stars[rules.chapter4Stage] ?? 0),
    floors,
    team: [
      ...team.wilds.map((w) => ({ id: w.id, name: nameOf(w.speciesId), hp: fallen.has(w.id) ? 0 : (misty.hp[w.id] ?? 1), fallen: fallen.has(w.id), helper: false })),
      ...misty.helpers.map((h) => ({ id: h.id, name: nameOf(h.speciesId), hp: fallen.has(h.id) ? 0 : (misty.hp[h.id] ?? 1), fallen: fallen.has(h.id), helper: true })),
    ],
    hireOffer: misty.hireOffer ? misty.hireOffer.map((id) => ({ speciesId: id, name: nameOf(id) })) : null,
    atShop: here ? tileOf(misty, here) === 'shop' : false,
    shop: rules.shop,
    gems: prepared.currencies.gems,
    forestCoin: prepared.currencies.forestCoin ?? 0,
  };
}
