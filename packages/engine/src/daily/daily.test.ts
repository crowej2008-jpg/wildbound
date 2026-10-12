import { describe, expect, it } from 'vitest';
import {
  activityPoints,
  addQuestProgress,
  claimAllMail,
  claimChest,
  claimQuest,
  claimableChests,
  createMail,
  emptyQuestState,
  hasClaimableMail,
  isQuestClaimable,
  pruneMail,
  questProgress,
  unclaimedMail,
  type QuestDef,
} from './index';

const DEFS: QuestDef[] = [
  { id: 'q_win', metric: 'winBattle', target: 3, activity: 10, rewards: { gold: 100 } },
  { id: 'q_level', metric: 'levelUp', target: 2, activity: 10, rewards: { candy: 50 } },
  { id: 'q_win10', metric: 'winBattle', target: 10, activity: 20, rewards: { gems: 20 } },
];
const CHESTS = [10, 30];

describe('daily quests', () => {
  it('tracks progress by metric and completion', () => {
    let s = emptyQuestState('2026-10-11');
    s = addQuestProgress(s, 'winBattle', 2);
    expect(questProgress(s, DEFS[0]!)).toBe(2);
    expect(isQuestClaimable(s, DEFS[0]!)).toBe(false);
    s = addQuestProgress(s, 'winBattle', 1);
    expect(isQuestClaimable(s, DEFS[0]!)).toBe(true);
    // One shared counter satisfies both winBattle quests independently.
    expect(questProgress(s, DEFS[2]!)).toBe(3);
  });

  it('accrues activity from claimed quests and unlocks chests', () => {
    let s = emptyQuestState('d');
    s = addQuestProgress(s, 'winBattle', 3);
    s = claimQuest(s, 'q_win');
    expect(activityPoints(DEFS, s)).toBe(10);
    expect(claimableChests(DEFS, s, CHESTS)).toEqual([0]);
    s = claimChest(s, 0);
    expect(claimableChests(DEFS, s, CHESTS)).toEqual([]);
  });
});

describe('mail', () => {
  it('builds letters, prunes on expiry and claims all', () => {
    const now = 1_000_000;
    const short = createMail({ id: 'm1', subjectKey: 's', bodyKey: 'b', grants: { gold: 1 }, createdAt: now, ttlMs: 100 });
    const long = createMail({ id: 'm2', subjectKey: 's', bodyKey: 'b', grants: { gold: 2 }, createdAt: now, ttlMs: 1000 });
    expect(unclaimedMail([short, long])).toHaveLength(2);
    const later = pruneMail([short, long], now + 500);
    expect(later.map((m) => m.id)).toEqual(['m2']);
    expect(hasClaimableMail(later)).toBe(true);
    const claimed = claimAllMail(later);
    expect(hasClaimableMail(claimed)).toBe(false);
  });
});
