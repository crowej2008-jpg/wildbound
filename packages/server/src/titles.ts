import type { TitleJson } from '@wildbound/content';
import {
  initialTitles,
  TITLE_SLOTS,
  type AccountState,
  type StatLine,
  type TitleFold,
  type TitleOwnership,
  type TitleSlot,
  type TitlesState,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { statLineText } from './gear-text';
import { fail, ok, type Result } from './index';

/**
 * R8 titles, copied from the source (packages/content/titles/titles.json, scripts/import-titles.mjs). Three
 * account-wide slots, one title each. A title is activated, raised a stage and (timed ones, at the top stage)
 * continued by paying its own activation card; timed titles expire lazily. Starter Trainer is owned from the start;
 * Beginner → Master Trainer cards come from the Tower floors the source pays them at. See ASSUMPTIONS #73.
 */

const DAY_MS = 86_400_000;

export const TITLE_SLOT_LABELS: Record<TitleSlot, string> = {
  common: 'Common Title',
  premium: 'Premium Title',
  rare: 'Rare Title',
};

export type TitleAction = 'activate' | 'upgrade' | 'continue';

export interface TitleSlotView {
  slot: TitleSlot;
  label: string;
  titleId: string | null;
  name: string | null;
  expiresAt: number | null;
  bonusText: string[];
}

export interface TitleRowView {
  id: string;
  name: string;
  slot: TitleSlot;
  durationDays: number | null;
  stage: number;
  maxStage: number;
  owned: boolean;
  equippedSlot: TitleSlot | null;
  expiresAt: number | null;
  bonusText: string[];
  action: TitleAction | null;
  /** Activation cards the next action costs, and how many are held. */
  nextCost: number | null;
  cards: number;
  /** The source's how-to-earn text, and where Wildbound gives it today. */
  earn: string | null;
  earnedHere: string | null;
  canAct: boolean;
}

export interface TitlesView {
  ownedCount: number;
  slots: TitleSlotView[];
  rows: TitleRowView[];
}

/** A fresh account's titles: the auto-granted ones (Starter Trainer) owned and worn. */
export function startingTitles(config: GameConfig): TitlesState {
  const titles = initialTitles();
  for (const title of config.titles) {
    if (title.earnedBy?.kind !== 'start') continue;
    titles.owned[title.id] = { stage: 1, expiresAt: null };
    if (titles.equipped[title.slot] === null) titles.equipped[title.slot] = title.id;
  }
  return titles;
}

/** Add activation cards for a title. */
export function grantTitleCards(state: AccountState, titleId: string, count: number): AccountState {
  const cards = { ...state.titles.cards, [titleId]: (state.titles.cards[titleId] ?? 0) + count };
  return { ...state, titles: { ...state.titles, cards } };
}

/** The Tower floor clears that pay title cards (source dun_tower_json achieve_reward). */
export function towerTitleCards(config: GameConfig, state: AccountState, floor: number): AccountState {
  let next = state;
  for (const title of config.titles) {
    if (title.earnedBy?.kind === 'tower' && title.earnedBy.floor === floor) next = grantTitleCards(next, title.id, 1);
  }
  return next;
}

function earnedHere(title: TitleJson): string | null {
  if (!title.earnedBy) return null;
  return title.earnedBy.kind === 'start' ? 'Owned from the start' : `Tower floor ${title.earnedBy.floor}`;
}

function stageStats(title: TitleJson, stage: number): StatLine[] {
  const index = Math.max(0, Math.min(title.stages.length - 1, stage - 1));
  return title.stages[index]?.stats ?? [];
}

function bonusText(title: TitleJson, stage: number): string[] {
  return stageStats(title, stage).map((line) => statLineText(line, 1));
}

function liveOwnership(state: AccountState, titleId: string, now: number): TitleOwnership | undefined {
  const owned = state.titles.owned[titleId];
  if (!owned) return undefined;
  if (owned.expiresAt !== null && owned.expiresAt <= now) return undefined;
  return owned;
}

function nextAction(title: TitleJson, owned: TitleOwnership | undefined): TitleAction | null {
  if (title.card === null) return null;
  if (!owned) return 'activate';
  if (owned.stage < title.stages.length) return 'upgrade';
  if (title.durationDays !== null) return 'continue';
  return null;
}

function nextCost(title: TitleJson, owned: TitleOwnership | undefined): number | null {
  const action = nextAction(title, owned);
  if (action === 'activate') return title.stages[0]?.cost ?? null;
  if (action === 'upgrade') return title.stages[owned!.stage]?.cost ?? null;
  if (action === 'continue') return title.continueCost;
  return null;
}

export function titleFoldFor(config: GameConfig, state: AccountState): TitleFold | undefined {
  const lines: StatLine[] = [];
  for (const slot of TITLE_SLOTS) {
    const titleId = state.titles.equipped[slot];
    if (!titleId) continue;
    const title = config.titleById.get(titleId);
    const owned = state.titles.owned[titleId];
    if (!title || !owned) continue;
    lines.push(...stageStats(title, owned.stage));
  }
  return lines.length > 0 ? { lines } : undefined;
}

export function buildTitlesView(config: GameConfig, state: AccountState, now: number): TitlesView {
  const equippedBy = new Map<string, TitleSlot>();
  for (const slot of TITLE_SLOTS) {
    const id = state.titles.equipped[slot];
    if (id) equippedBy.set(id, slot);
  }
  const slots: TitleSlotView[] = TITLE_SLOTS.map((slot) => {
    const titleId = state.titles.equipped[slot];
    const title = titleId ? config.titleById.get(titleId) : undefined;
    const owned = titleId ? liveOwnership(state, titleId, now) : undefined;
    return {
      slot,
      label: TITLE_SLOT_LABELS[slot],
      titleId: title && owned ? title.id : null,
      name: title && owned ? title.name : null,
      expiresAt: owned?.expiresAt ?? null,
      bonusText: title && owned ? bonusText(title, owned.stage) : [],
    };
  });

  const rows: TitleRowView[] = [...config.titles]
    .sort((a, b) => TITLE_SLOTS.indexOf(a.slot) - TITLE_SLOTS.indexOf(b.slot) || a.order - b.order)
    .map((title) => {
      const owned = liveOwnership(state, title.id, now);
      const action = nextAction(title, owned);
      const cost = nextCost(title, owned);
      const cards = state.titles.cards[title.id] ?? 0;
      return {
        id: title.id,
        name: title.name,
        slot: title.slot,
        durationDays: title.durationDays,
        stage: owned?.stage ?? 0,
        maxStage: title.stages.length,
        owned: owned !== undefined,
        equippedSlot: equippedBy.get(title.id) ?? null,
        expiresAt: owned?.expiresAt ?? null,
        // Source: owned shows the current stage's stats, not owned shows stage 1's.
        bonusText: bonusText(title, owned?.stage ?? 1),
        action,
        nextCost: cost,
        cards,
        earn: title.earn,
        earnedHere: earnedHere(title),
        canAct: action !== null && cost !== null && cards >= cost,
      };
    });

  const ownedCount = config.titles.filter((title) => liveOwnership(state, title.id, now)).length;
  return { ownedCount, slots, rows };
}

export function activateTitleAction(
  config: GameConfig,
  state: AccountState,
  titleId: string,
  now: number,
): Result<AccountState> {
  const title = config.titleById.get(titleId);
  if (!title) return fail('not_found', `no title "${titleId}"`);
  const existing = liveOwnership(state, titleId, now);
  const action = nextAction(title, existing);
  if (action === null) {
    return title.card === null
      ? fail('resource_locked', `${title.name} is not activated with a card`)
      : fail('at_level_cap', `${title.name} is already at max stage`);
  }
  const cost = nextCost(title, existing) ?? 0;
  const cards = state.titles.cards[titleId] ?? 0;
  if (cards < cost) return fail('insufficient_items', `not enough ${title.name} activation cards`);

  let stage: number;
  let expiresAt: number | null;
  if (!existing) {
    stage = 1;
    expiresAt = title.durationDays === null ? null : now + title.durationDays * DAY_MS;
  } else if (action === 'upgrade') {
    stage = existing.stage + 1;
    expiresAt = existing.expiresAt;
  } else {
    stage = existing.stage;
    expiresAt = Math.max(now, existing.expiresAt ?? now) + (title.durationDays ?? 0) * DAY_MS;
  }

  const owned = { ...state.titles.owned, [title.id]: { stage, expiresAt } };
  const equipped = { ...state.titles.equipped };
  if (equipped[title.slot] === null || equipped[title.slot] === title.id) equipped[title.slot] = title.id;
  const nextCards = { ...state.titles.cards, [title.id]: cards - cost };
  if (nextCards[title.id] === 0) delete nextCards[title.id];
  return ok({ ...state, titles: { owned, equipped, cards: nextCards } });
}

export function setTitleSlotAction(
  config: GameConfig,
  state: AccountState,
  slot: TitleSlot,
  titleId: string | null,
  now: number,
): Result<AccountState> {
  if (!TITLE_SLOTS.includes(slot)) return fail('invalid_input', `no title slot "${slot}"`);
  if (titleId !== null) {
    const title = config.titleById.get(titleId);
    if (!title) return fail('not_found', `no title "${titleId}"`);
    if (title.slot !== slot) return fail('invalid_input', `${title.name} is not a ${slot} title`);
    if (!liveOwnership(state, titleId, now)) return fail('resource_locked', `${title.name} is not owned`);
  }
  return ok({
    ...state,
    titles: { ...state.titles, equipped: { ...state.titles.equipped, [slot]: titleId } },
  });
}
