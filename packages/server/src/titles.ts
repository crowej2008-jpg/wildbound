import type { TitleJson } from '@wildbound/content';
import {
  TITLE_SLOTS,
  type AccountState,
  type StatLine,
  type TitleFold,
  type TitleOwnership,
  type TitleSlot,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { pay } from './equipment';
import { statLineText } from './gear-text';
import { fail, ok, type Result } from './index';

/**
 * M11.11 titles. Three account-wide slots (Common / Premium / Rare); one title
 * per slot. Permanent titles are a one-off cost, timed titles expire lazily and
 * can be continued at max stage. See docs/design/collection.md.
 */

const DAY_MS = 86_400_000;

export const TITLE_SLOT_LABELS: Record<TitleSlot, string> = {
  common: 'Common Title',
  premium: 'Premium Title',
  rare: 'Rare Title',
};

const SOURCE_LABELS: Record<TitleJson['source'], string> = {
  trainer: 'Trainer',
  collection: 'Collection',
  arena: 'Arena',
  ranked: 'Ranked',
  guild: 'Guild war',
  event: 'Event',
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
  source: TitleJson['source'];
  sourceLabel: string;
  durationDays: number | null;
  stage: number;
  maxStage: number;
  owned: boolean;
  equippedSlot: TitleSlot | null;
  expiresAt: number | null;
  bonusText: string[];
  action: TitleAction | null;
  nextCost: number | null;
  requirementText: string | null;
  requirementMet: boolean;
  available: boolean;
  lockedReason: 'guild' | 'event' | null;
  canAct: boolean;
}

export interface TitlesView {
  tickets: number;
  ownedCount: number;
  slots: TitleSlotView[];
  rows: TitleRowView[];
}

function available(title: TitleJson): boolean {
  return title.source !== 'guild' && title.source !== 'event';
}

function requirementMet(state: AccountState, title: TitleJson): boolean {
  const requirement = title.requirement;
  if (!requirement) return true;
  switch (requirement.kind) {
    case 'trainerLevel':
      return state.profile.level >= requirement.value;
    case 'uniqueSpecies':
      return new Set(state.roster.map((wild) => wild.speciesId)).size >= requirement.value;
    case 'arenaCredits':
      return state.pvp.arena.bestCredits >= requirement.value;
    case 'arenaBestPlace':
      return state.pvp.arena.bestPlace > 0 && state.pvp.arena.bestPlace <= requirement.value;
    case 'rankedWins':
      return state.pvp.ranked.wins >= requirement.value;
  }
}

function requirementText(title: TitleJson): string | null {
  const requirement = title.requirement;
  if (!requirement) return null;
  switch (requirement.kind) {
    case 'trainerLevel':
      return `Trainer level ${requirement.value}`;
    case 'uniqueSpecies':
      return `${requirement.value} unique species`;
    case 'arenaCredits':
      return `Arena best ${requirement.value} credits`;
    case 'arenaBestPlace':
      return `Arena best place ${requirement.value}`;
    case 'rankedWins':
      return `Ranked ${requirement.value} wins`;
  }
}

function stageStats(title: TitleJson, stage: number): StatLine[] {
  const index = Math.max(0, Math.min(title.stages.length - 1, stage - 1));
  return title.stages[index]?.stats ?? [];
}

function bonusText(title: TitleJson, stage: number): string[] {
  return stageStats(title, stage).map((line) => statLineText(line, 1));
}

function liveOwnership(
  state: AccountState,
  titleId: string,
  now: number,
): TitleOwnership | undefined {
  const owned = state.titles.owned[titleId];
  if (!owned) return undefined;
  if (owned.expiresAt !== null && owned.expiresAt <= now) return undefined;
  return owned;
}

function nextCost(title: TitleJson, owned: TitleOwnership | undefined): number | null {
  if (!owned) return title.stages[0]?.cost ?? null;
  if (owned.stage < title.stages.length) return title.stages[owned.stage]?.cost ?? null;
  if (title.durationDays !== null) return title.stages[title.stages.length - 1]?.cost ?? null;
  return null;
}

function nextAction(title: TitleJson, owned: TitleOwnership | undefined): TitleAction | null {
  if (!owned) return 'activate';
  if (owned.stage < title.stages.length) return 'upgrade';
  if (title.durationDays !== null) return 'continue';
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

  const rows: TitleRowView[] = config.titles.map((title) => {
    const owned = liveOwnership(state, title.id, now);
    const action = nextAction(title, owned);
    const requirementOk = requirementMet(state, title);
    const unlocked = available(title);
    const cost = nextCost(title, owned);
    const equippedSlot = equippedBy.get(title.id) ?? null;
    return {
      id: title.id,
      name: title.name,
      slot: title.slot,
      source: title.source,
      sourceLabel: SOURCE_LABELS[title.source],
      durationDays: title.durationDays,
      stage: owned?.stage ?? 0,
      maxStage: title.stages.length,
      owned: owned !== undefined,
      equippedSlot,
      expiresAt: owned?.expiresAt ?? null,
      bonusText: bonusText(title, owned?.stage ?? 1),
      action,
      nextCost: cost,
      requirementText: requirementText(title),
      requirementMet: requirementOk,
      available: unlocked,
      lockedReason: title.source === 'guild' ? 'guild' : title.source === 'event' ? 'event' : null,
      canAct: unlocked && requirementOk && action !== null && cost !== null && state.currencies.titleTicket >= cost,
    };
  });

  return {
    tickets: state.currencies.titleTicket,
    ownedCount: Object.keys(state.titles.owned).length,
    slots,
    rows,
  };
}

export function activateTitleAction(
  config: GameConfig,
  state: AccountState,
  titleId: string,
  now: number,
): Result<AccountState> {
  const title = config.titleById.get(titleId);
  if (!title) return fail('not_found', `no title "${titleId}"`);
  if (!available(title)) return fail('resource_locked', `${title.name} is not live yet`);
  if (!requirementMet(state, title)) {
    return fail('resource_locked', requirementText(title) ?? 'requirement not met');
  }

  const existing = liveOwnership(state, titleId, now);
  const action = nextAction(title, existing);
  if (action === null) return fail('at_level_cap', `${title.name} is already at max stage`);

  let stage: number;
  let expiresAt: number | null;
  let cost: number;
  if (!existing) {
    stage = 1;
    cost = title.stages[0]?.cost ?? 0;
    expiresAt = title.durationDays === null ? null : now + title.durationDays * DAY_MS;
  } else if (existing.stage < title.stages.length) {
    stage = existing.stage + 1;
    cost = title.stages[existing.stage]?.cost ?? 0;
    expiresAt = existing.expiresAt;
  } else {
    stage = existing.stage;
    cost = title.stages[title.stages.length - 1]?.cost ?? 0;
    expiresAt = Math.max(now, existing.expiresAt ?? now) + (title.durationDays ?? 0) * DAY_MS;
  }

  const paid = pay(state, { titleTicket: cost });
  if (!paid) return fail('insufficient_items', 'not enough Title Tickets');

  const owned = { ...paid.titles.owned, [title.id]: { stage, expiresAt } };
  const equipped = { ...paid.titles.equipped };
  if (equipped[title.slot] === null || equipped[title.slot] === title.id) {
    equipped[title.slot] = title.id;
  }
  return ok({ ...paid, titles: { owned, equipped } });
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
